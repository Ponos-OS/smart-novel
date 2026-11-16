// Package beatrice talks to Beatrice, the service that explains words and turns chapters into audio with an LLM. The client is generated from
// the schema of the Beatrice version in .env and from the operations in operations.graphql.
package beatrice

//go:generate go tool genqlient
