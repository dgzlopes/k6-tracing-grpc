// Package config provides initialization of OpenTelemetry setup.
package config

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	stdout "go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"

	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"google.golang.org/grpc/credentials"
)

// Init sets up OpenTelemetry with either stdout (local) or remote OTLP exporter (Grafana Cloud).
func Init() (*sdktrace.TracerProvider, error) {
	ctx := context.Background()

	user := os.Getenv("GRAFANA_CLOUD_USER")
	key := os.Getenv("GRAFANA_CLOUD_API_KEY")
	endpoint := os.Getenv("GRAFANA_CLOUD_TRACES_ENDPOINT") // e.g., tempo-prod-10-prod-eu-west-2.grafana.net:443

	var tp *sdktrace.TracerProvider
	var err error

	if user != "" && key != "" && endpoint != "" {
		fmt.Println("Using Grafana Cloud OTLP exporter at", endpoint)
		tp, err = initRemote(ctx, user, key, endpoint)
	} else {
		fmt.Println("Using stdout OpenTelemetry exporter")
		tp, err = initLocal()
	}
	if err != nil {
		return nil, err
	}

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	return tp, nil
}

func initRemote(ctx context.Context, user, key, endpoint string) (*sdktrace.TracerProvider, error) {
	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+key))

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithHeaders(map[string]string{
			"authorization": authHeader,
		}),
		otlptracegrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, "")),
		otlptracegrpc.WithCompressor("gzip"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create remote OTLP exporter: %w", err)
	}

	return sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("grpc-hello"),
		)),
	), nil
}

func initLocal() (*sdktrace.TracerProvider, error) {
	exporter, err := stdout.New(stdout.WithPrettyPrint())
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout exporter: %w", err)
	}

	return sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithBatcher(exporter),
	), nil
}
