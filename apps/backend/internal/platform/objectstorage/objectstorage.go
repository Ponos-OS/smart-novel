// Package objectstorage is the backend's client of the S3-compatible bucket. It wraps the AWS SDK so the rest of the code does not know the
// library: it signs the URLs a browser uploads to, looks at an object, and removes one.
package objectstorage

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/config"
)

// Client reaches the bucket on the endpoint of the cluster, and signs upload URLs for the endpoint a browser reaches it on: the signature
// covers the host, so a URL signed for the first does not work from a browser.
type Client struct {
	bucket    string
	publicURL string
	storage   *s3.Client
	signer    *s3.PresignClient
}

// Object is what the bucket says about a stored object.
type Object struct {
	ContentType   string
	ContentLength int64
}

func Open(ctx context.Context, cfg config.ObjectStorage) (*Client, error) {
	options := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(cfg.Region)}
	if cfg.AccessKey != "" {
		options = append(options, awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")))
	}
	loaded, err := awsconfig.LoadDefaultConfig(ctx, options...)
	if err != nil {
		return nil, fmt.Errorf("loading the object storage configuration: %w", err)
	}
	// Path style, because a bucket name is not a host name on RustFS or any other S3-compatible storage.
	storage := s3.NewFromConfig(loaded, func(o *s3.Options) {
		o.UsePathStyle = true
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
	})
	forBrowsers := s3.NewFromConfig(loaded, func(o *s3.Options) {
		o.UsePathStyle = true
		o.BaseEndpoint = aws.String(cfg.PublicURL)
	})

	return &Client{bucket: cfg.Bucket, publicURL: strings.TrimRight(cfg.PublicURL, "/"), storage: storage, signer: s3.NewPresignClient(forBrowsers)}, nil
}

// PresignUpload signs a PUT of one object, for a browser. The content type and the size are part of the signature, so the bucket refuses a
// body of another type or size.
func (c *Client) PresignUpload(ctx context.Context, key, contentType string, contentLength int64, ttl time.Duration) (string, error) {
	signed, err := c.signer.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(contentLength),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("signing an upload URL: %w", err)
	}

	return signed.URL, nil
}

// Head looks at an object; found is false when there is none.
func (c *Client) Head(ctx context.Context, key string) (object Object, found bool, err error) {
	head, err := c.storage.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(c.bucket), Key: aws.String(key)})
	var notFound *types.NotFound
	if errors.As(err, &notFound) {
		return Object{}, false, nil
	}
	if err != nil {
		return Object{}, false, fmt.Errorf("looking at %s: %w", key, err)
	}

	return Object{ContentType: aws.ToString(head.ContentType), ContentLength: aws.ToInt64(head.ContentLength)}, true, nil
}

// Delete removes an object; one that is not there is not an error.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.storage.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(c.bucket), Key: aws.String(key)})
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchKey" {
		return nil
	}
	if err != nil {
		return fmt.Errorf("deleting %s: %w", key, err)
	}

	return nil
}

// URLOf is where anybody reads the object.
func (c *Client) URLOf(key string) string {
	return c.publicURL + "/" + c.bucket + "/" + key
}

// KeyOf is the key of an object that URLOf gave the URL of; found is false for any other URL.
func (c *Client) KeyOf(url string) (key string, found bool) {
	return strings.CutPrefix(url, c.publicURL+"/"+c.bucket+"/")
}
