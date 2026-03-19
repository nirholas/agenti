# Faremeter Architecture

## Philosophy

The core principles that Faremeter incorporates in its design are:

- Composability
- Extensibility
- Standards Agnostic
- Pragmatic

All of the libraries and applications built as part of the project
work together to flexibly support as many payment standards as desired
and can be supported. This allows us to innovate rapidly, while still
keeping the tooling compatible with emerging industry standards.

## Implementation Concepts

To accomplish an implementation that matches our philosophy, we focus on interfaces and loose coupling. It should be possible to use plugins from our project, along with code from any other project, with a minimal amount of glue.

Rather than focusing on classes with specific implementations, we provide clear interface boundaries; how those interfaces are implemented is flexible.

Developers should be able to take the components they need to accomplish their goals, without importing all of the project.

## High-Level Design

Using the nomenclature from the x402 standard, there are 3 participants in a payment:

- The client (who is paying).
- The resource the client is interested in paying for (i.e. the API).
- The resource server who provides the resource.
- The facilitator who is responsible for handling payments for the service.

The desire is for the resource server to not have any real concept of the mechanics required to handle receiving payments, and for the facilitator to be responsible for this. This allows for legacy APIs/systems to have payments added to them, without needing invasive changes. Faremeter accomplishes this by providing middleware, and a payment-aware HTTP proxy on the resource server side.

The client and the facilitator both need to be aware of the underlying payment mechanics. In order to accomplish this, we provide a library that you can plug payment mechanisms into. If a facilitator wants to support accepting e.g. payments on Solana mainnet-beta, they would import and connect the Solana facilitator handler plugin. The client would do similar, it would hookup their wallet (e.g. Squads smart wallet) to the Solana mainnet-beta payment plugin.

Because a client and a facilitator may have many ways to pay and be paid, Faremeter accommodates these different mechanics with plugins, where each type of payment style uses a unique tuple to identify and express the mechanics it supports. To use the x402 terminology the `scheme` and `network` (along with any other information required by the plugin) determine if a given plugin will be used to handle paying and receiving payment.

This model applies to both the Faremeter client libraries (e.g. `@faremeter/fetch`) and the facilitator.
