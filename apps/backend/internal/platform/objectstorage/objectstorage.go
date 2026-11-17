// Package objectstorage is the backend's client of the S3-compatible bucket. It wraps the AWS SDK so the rest of the code does not know the
// library: it signs upload URLs, looks at an object, and removes one.
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

// Client reaches the bucket on the endpoint of the cluster, and signs upload URLs for that endpoint or for the public one: a signature covers
// the host, so a URL signed for one does not work on the other.
type Client struct {
	bucket    string
	publicURL string
	storage   *s3.Client
	// publicSigner signs for the public endpoint, clusterSigner for the one other services of the cluster reach the bucket on.
	publicSigner  *s3.PresignClient
	clusterSigner *s3.PresignClient
}

// Object is what the bucket says about a stored object.
type Object struct {
	ContentType   string
	ContentLength int64
}

func Open(ctx context.Context, cfg config.ObjectStorage) (*Client, error) {
	options := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(cfg.Region),
	}
	if cfg.AccessKey != "" {
		options = append(
			options,
			awsconfig.WithCredentialsProvider(
				credentials.NewStaticCredentialsProvider(
					cfg.AccessKey,
					cfg.SecretKey,
					"",
				),
			),
		)
	}
	loaded, err := awsconfig.LoadDefaultConfig(ctx, options...)
	if err != nil {
		return nil, fmt.Errorf(
			"loading the object storage configuration: %w",
			err,
		)
	}
	// Path style, because a bucket name is not a host name on RustFS or any other S3-compatible storage.
	storage := s3.NewFromConfig(loaded, func(o *s3.Options) {
		o.UsePathStyle = true
		if cfg.Endpoint != "" {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
		}
	})
	forPublic := s3.NewFromConfig(loaded, func(o *s3.Options) {
		o.UsePathStyle = true
		o.BaseEndpoint = aws.String(cfg.PublicURL)
	})

	return &Client{
		bucket:        cfg.Bucket,
		publicURL:     strings.TrimRight(cfg.PublicURL, "/"),
		storage:       storage,
		publicSigner:  s3.NewPresignClient(forPublic),
		clusterSigner: s3.NewPresignClient(storage),
	}, nil
}

// PresignPublicUpload signs a PUT of one object for the public endpoint, the one anybody outside the cluster reaches, a browser included.
// A signature covers the host, so the URL works only there. The content type and the size are part of the signature, so the bucket refuses a
// body of another type or size.
func (c *Client) PresignPublicUpload(
	ctx context.Context,
	key, contentType string,
	contentLength int64,
	ttl time.Duration,
) (string, error) {
	return c.sign(ctx, c.publicSigner, key, contentType, &contentLength, ttl)
}

// PresignClusterUpload signs a PUT of one object for the cluster endpoint, which only a service inside the cluster reaches. The size is not
// known beforehand, so only the content type is signed.
func (c *Client) PresignClusterUpload(
	ctx context.Context,
	key, contentType string,
	ttl time.Duration,
) (string, error) {
	return c.sign(ctx, c.clusterSigner, key, contentType, nil, ttl)
}

// sign builds the PUT once; a nil contentLength leaves the size out of the signature.
func (c *Client) sign(
	ctx context.Context,
	signer *s3.PresignClient,
	key, contentType string,
	contentLength *int64,
	ttl time.Duration,
) (string, error) {
	signed, err := signer.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(c.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: contentLength,
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", fmt.Errorf("signing an upload URL: %w", err)
	}

	return signed.URL, nil
}

// Head looks at an object; found is false when there is none.
func (c *Client) Head(
	ctx context.Context,
	key string,
) (object Object, found bool, err error) {
	head, err := c.storage.HeadObject(
		ctx,
		&s3.HeadObjectInput{Bucket: aws.String(c.bucket), Key: aws.String(key)},
	)
	var notFound *types.NotFound
	if errors.As(err, &notFound) {
		return Object{}, false, nil
	}
	if err != nil {
		return Object{}, false, fmt.Errorf("looking at %s: %w", key, err)
	}

	return Object{
		ContentType:   aws.ToString(head.ContentType),
		ContentLength: aws.ToInt64(head.ContentLength),
	}, true, nil
}

// Delete removes an object; one that is not there is not an error.
func (c *Client) Delete(ctx context.Context, key string) error {
	_, err := c.storage.DeleteObject(
		ctx,
		&s3.DeleteObjectInput{
			Bucket: aws.String(c.bucket),
			Key:    aws.String(key),
		},
	)
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
