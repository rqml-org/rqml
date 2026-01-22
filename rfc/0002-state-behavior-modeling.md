---
rfc: 0002
title: "State and Behavior Modeling"
status: Draft
author: "Claude (AI Assistant)"
created: 2026-01-22
requires-version: "2.0.1"
---

# Summary

Add optional `behavior` section to RQML for modeling state machines and transitions. This enables specification of entity lifecycles, workflow states, and protocol behaviors in a structured, LLM-readable format.

# Motivation

Many systems have entities with well-defined lifecycles (orders, payments, tickets, users) or protocols with specific state sequences. Currently, RQML authors must describe these in free-text narratives, which:

1. **Reduces precision**: "An order can be cancelled before it ships" is ambiguous about exact states and conditions
2. **Limits code generation**: LLMs cannot reliably generate state machine implementations from prose
3. **Obscures completeness**: Hard to verify all transitions are specified and all states are reachable
4. **Complicates testing**: No structured basis for generating state transition tests

**Real examples where this matters:**

- Payment processing: `pending → authorized → captured → settled` (with `declined`, `refunded`, `chargedback` branches)
- Order fulfillment: `created → confirmed → picking → packed → shipped → delivered` (with cancellation paths)
- Document workflow: `draft → review → approved → published` (with rejection loops)
- User account: `pending → active → suspended → closed` (with reactivation paths)
- Protocol handshakes: Connection establishment, authentication flows, transaction protocols

# Goals

- Enable structured specification of finite state machines for entities
- Support guards (conditions) and actions on transitions
- Allow linking states/transitions to requirements for traceability
- Maintain RQML's philosophy: human-readable, LLM-friendly, not overly complex
- Provide sufficient structure for code generation of state machine implementations

# Non-goals

- Full UML statechart semantics (hierarchical states, orthogonal regions, history states)
- Sequence diagrams or interaction specifications (may be a separate RFC)
- Formal temporal logic (LTL, CTL) - too specialized
- Executable specification language - RQML is declarative, not executable
- Petri nets or other advanced concurrency formalisms

# Proposed design

## Schema changes

Add a new optional top-level section `behavior` after `domain` and before `goals`:

```xml
<xs:element name="behavior" type="BehaviorType" minOccurs="0"/>
```

### BehaviorType

```xml
<xs:complexType name="BehaviorType">
  <xs:sequence>
    <xs:element name="stateMachine" type="StateMachineType"
                minOccurs="0" maxOccurs="unbounded"/>
  </xs:sequence>
</xs:complexType>
```

### StateMachineType

```xml
<xs:complexType name="StateMachineType">
  <xs:sequence>
    <xs:element name="description" type="TextBlockType" minOccurs="0"/>
    <xs:element name="state" type="StateType" minOccurs="1" maxOccurs="unbounded"/>
    <xs:element name="transition" type="TransitionType" minOccurs="0" maxOccurs="unbounded"/>
  </xs:sequence>
  <xs:attribute name="id" type="IdType" use="required"/>
  <xs:attribute name="name" type="xs:string" use="required"/>
  <xs:attribute name="entityRef" type="IdType" use="optional"/>
  <xs:attribute name="initial" type="IdType" use="required"/>
</xs:complexType>
```

**Attributes:**
- `id`: Unique identifier (e.g., `SM-ORDER`, `SM-PAYMENT`)
- `name`: Human-readable name
- `entityRef`: Optional reference to domain entity this state machine governs
- `initial`: Required reference to the initial state ID

### StateType

```xml
<xs:complexType name="StateType">
  <xs:sequence>
    <xs:element name="description" type="TextBlockType" minOccurs="0"/>
    <xs:element name="onEntry" type="TextBlockType" minOccurs="0"/>
    <xs:element name="onExit" type="TextBlockType" minOccurs="0"/>
    <xs:element name="invariant" type="TextBlockType" minOccurs="0"/>
  </xs:sequence>
  <xs:attribute name="id" type="IdType" use="required"/>
  <xs:attribute name="name" type="xs:string" use="required"/>
  <xs:attribute name="type" type="StateKindType" use="optional" default="normal"/>
</xs:complexType>

<xs:simpleType name="StateKindType">
  <xs:restriction base="xs:token">
    <xs:enumeration value="initial"/>
    <xs:enumeration value="normal"/>
    <xs:enumeration value="final"/>
  </xs:restriction>
</xs:simpleType>
```

**Attributes:**
- `id`: Unique identifier (e.g., `ST-PENDING`, `ST-SHIPPED`)
- `name`: Human-readable state name
- `type`: `initial`, `normal`, or `final` (default: `normal`)

**Children:**
- `description`: What this state represents
- `onEntry`: Actions to perform when entering this state
- `onExit`: Actions to perform when leaving this state
- `invariant`: Conditions that must hold while in this state

### TransitionType

```xml
<xs:complexType name="TransitionType">
  <xs:sequence>
    <xs:element name="description" type="TextBlockType" minOccurs="0"/>
    <xs:element name="trigger" type="TextBlockType" minOccurs="0"/>
    <xs:element name="guard" type="TextBlockType" minOccurs="0"/>
    <xs:element name="action" type="TextBlockType" minOccurs="0"/>
    <xs:element name="refs" type="RefsType" minOccurs="0"/>
  </xs:sequence>
  <xs:attribute name="id" type="IdType" use="required"/>
  <xs:attribute name="from" type="IdType" use="required"/>
  <xs:attribute name="to" type="IdType" use="required"/>
  <xs:attribute name="event" type="xs:string" use="optional"/>
</xs:complexType>
```

**Attributes:**
- `id`: Unique identifier (e.g., `TR-SHIP`, `TR-CANCEL`)
- `from`: Source state ID
- `to`: Target state ID
- `event`: Optional event name that triggers this transition

**Children:**
- `description`: Human-readable description of this transition
- `trigger`: What causes this transition (if not captured by `event`)
- `guard`: Condition that must be true for transition to fire
- `action`: What happens during the transition
- `refs`: Links to requirements this transition implements

### Key/Keyref additions

Add to the root `rqml` element's key selector:

```xml
<xs:selector xpath=".//state|.//transition|.//stateMachine|...existing..."/>
```

Add keyrefs for state machine references:

```xml
<xs:keyref name="smInitialRef" refer="allIds">
  <xs:selector xpath=".//stateMachine"/>
  <xs:field xpath="@initial"/>
</xs:keyref>
<xs:keyref name="transitionFromRef" refer="allIds">
  <xs:selector xpath=".//transition"/>
  <xs:field xpath="@from"/>
</xs:keyref>
<xs:keyref name="transitionToRef" refer="allIds">
  <xs:selector xpath=".//transition"/>
  <xs:field xpath="@to"/>
</xs:keyref>
```

## Semantics

### State Machine Interpretation

A state machine describes the valid lifecycle of an entity or process:

- Exactly one state is marked as `initial` (or referenced by `@initial` attribute)
- States with `type="final"` are terminal; no outgoing transitions allowed
- An entity is always in exactly one state at a time
- Transitions are instantaneous; guards are evaluated atomically

### For LLMs: Code Generation

When generating code from state machines:

1. **State enum/type**: Generate an enumeration or union type from state names
2. **Transition function**: Generate a function that validates and executes transitions
3. **Guard evaluation**: Generate condition checks from guard text
4. **Event handlers**: Generate event handler stubs from transition events
5. **State persistence**: Entity's current state should be a persisted field

### For LLMs: Test Generation

State machines enable systematic test generation:

1. **Happy path**: Test the most common sequence from initial to final
2. **All transitions**: Test each transition at least once
3. **Invalid transitions**: Test that disallowed transitions are rejected
4. **Guard conditions**: Test boundary conditions on guards
5. **State coverage**: Ensure all states are reachable in tests

## Examples

### Before (current RQML)

```xml
<domain>
  <entities>
    <entity id="ENT-ORDER" name="Order">
      <attr id="ATTR-STATUS" name="status" type="string" required="true">
        <description>Order status</description>
        <constraints>One of: pending, confirmed, shipped, delivered, cancelled</constraints>
      </attr>
    </entity>
  </entities>
</domain>

<requirements>
  <req id="REQ-ORDER-CANCEL" type="FR" title="Order cancellation">
    <statement>The system SHALL allow cancellation of orders that have not shipped.</statement>
  </req>
  <req id="REQ-ORDER-SHIP" type="FR" title="Order shipping">
    <statement>The system SHALL transition confirmed orders to shipped when dispatched.</statement>
  </req>
</requirements>
```

This leaves ambiguity: What are all the valid transitions? Can a delivered order be cancelled? What happens to a pending order?

### After (with this proposal)

```xml
<domain>
  <entities>
    <entity id="ENT-ORDER" name="Order">
      <attr id="ATTR-STATUS" name="status" type="enum:pending,confirmed,shipped,delivered,cancelled" required="true">
        <description>Order lifecycle status (see SM-ORDER)</description>
      </attr>
    </entity>
  </entities>
</domain>

<behavior>
  <stateMachine id="SM-ORDER" name="Order Lifecycle" entityRef="ENT-ORDER" initial="ST-PENDING">
    <description>
      Defines the valid state transitions for an Order from creation to completion.
    </description>

    <!-- States -->
    <state id="ST-PENDING" name="Pending" type="initial">
      <description>Order created but not yet confirmed by merchant</description>
      <invariant>Payment not yet captured</invariant>
    </state>

    <state id="ST-CONFIRMED" name="Confirmed">
      <description>Order confirmed and payment authorized</description>
      <onEntry>Send confirmation email to customer</onEntry>
    </state>

    <state id="ST-SHIPPED" name="Shipped">
      <description>Order dispatched to carrier</description>
      <onEntry>Capture payment; send shipping notification</onEntry>
    </state>

    <state id="ST-DELIVERED" name="Delivered" type="final">
      <description>Order received by customer</description>
    </state>

    <state id="ST-CANCELLED" name="Cancelled" type="final">
      <description>Order cancelled before shipment</description>
      <onEntry>Release payment authorization; restore inventory</onEntry>
    </state>

    <!-- Transitions -->
    <transition id="TR-CONFIRM" from="ST-PENDING" to="ST-CONFIRMED" event="confirm">
      <description>Merchant confirms the order</description>
      <guard>Payment authorization successful</guard>
      <action>Reserve inventory</action>
      <refs><ref ref="REQ-ORDER-CONFIRM"/></refs>
    </transition>

    <transition id="TR-SHIP" from="ST-CONFIRMED" to="ST-SHIPPED" event="ship">
      <description>Order dispatched to carrier</description>
      <guard>All items picked and packed</guard>
      <action>Generate tracking number; notify carrier</action>
      <refs><ref ref="REQ-ORDER-SHIP"/></refs>
    </transition>

    <transition id="TR-DELIVER" from="ST-SHIPPED" to="ST-DELIVERED" event="deliver">
      <description>Carrier confirms delivery</description>
      <trigger>Carrier webhook or manual confirmation</trigger>
    </transition>

    <transition id="TR-CANCEL-PENDING" from="ST-PENDING" to="ST-CANCELLED" event="cancel">
      <description>Cancel before confirmation</description>
      <refs><ref ref="REQ-ORDER-CANCEL"/></refs>
    </transition>

    <transition id="TR-CANCEL-CONFIRMED" from="ST-CONFIRMED" to="ST-CANCELLED" event="cancel">
      <description>Cancel after confirmation but before shipment</description>
      <guard>Shipment not yet dispatched</guard>
      <refs><ref ref="REQ-ORDER-CANCEL"/></refs>
    </transition>
  </stateMachine>
</behavior>

<requirements>
  <req id="REQ-ORDER-CONFIRM" type="FR" title="Order confirmation">
    <statement>The system SHALL transition pending orders to confirmed upon merchant approval with valid payment authorization.</statement>
  </req>
  <req id="REQ-ORDER-SHIP" type="FR" title="Order shipping">
    <statement>The system SHALL transition confirmed orders to shipped when all items are dispatched.</statement>
  </req>
  <req id="REQ-ORDER-CANCEL" type="FR" title="Order cancellation">
    <statement>The system SHALL allow cancellation of orders in pending or confirmed states.</statement>
    <rationale>Customers may change their mind; merchants may detect fraud.</rationale>
  </req>
</requirements>

<trace>
  <traceEdge id="TR-SM-ORDER" from="SM-ORDER" to="ENT-ORDER" type="refines">
    <notes>State machine defines the lifecycle of the Order entity</notes>
  </traceEdge>
</trace>
```

### Generated Code Example (TypeScript)

An LLM could generate from the above:

```typescript
enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

type OrderEvent = 'confirm' | 'ship' | 'deliver' | 'cancel';

interface OrderTransition {
  from: OrderStatus;
  to: OrderStatus;
  event: OrderEvent;
  guard?: (order: Order) => boolean;
}

const ORDER_TRANSITIONS: OrderTransition[] = [
  { from: OrderStatus.Pending, to: OrderStatus.Confirmed, event: 'confirm',
    guard: (o) => o.paymentAuthorized },
  { from: OrderStatus.Confirmed, to: OrderStatus.Shipped, event: 'ship',
    guard: (o) => o.allItemsPacked },
  { from: OrderStatus.Shipped, to: OrderStatus.Delivered, event: 'deliver' },
  { from: OrderStatus.Pending, to: OrderStatus.Cancelled, event: 'cancel' },
  { from: OrderStatus.Confirmed, to: OrderStatus.Cancelled, event: 'cancel',
    guard: (o) => !o.shipmentDispatched },
];

function transitionOrder(order: Order, event: OrderEvent): Order {
  const transition = ORDER_TRANSITIONS.find(
    t => t.from === order.status && t.event === event
  );
  if (!transition) {
    throw new Error(`Invalid transition: ${event} from ${order.status}`);
  }
  if (transition.guard && !transition.guard(order)) {
    throw new Error(`Guard failed for transition: ${event}`);
  }
  return { ...order, status: transition.to };
}
```

# Compatibility

## Impact on existing documents

- **Fully backward compatible**: `behavior` is a new optional section
- Existing valid RQML 2.0.1 documents remain valid
- Documents without `behavior` section work as before

## Impact on tools/validators

- Validators must be updated to recognize the new section
- Tools that don't understand `behavior` can safely ignore it
- Code generators gain new capabilities but don't break on old documents

## Version considerations

This RFC proposes these changes for RQML 2.1.0 (minor version bump due to additive changes).

# Migration plan

## Automated migration

Not applicable - this is purely additive. No existing documents need modification.

## Adoption guidance

1. **Identify entities with lifecycle**: Review domain entities for status/state fields
2. **Extract implicit state machines**: Convert prose descriptions in requirements to structured state machines
3. **Link transitions to requirements**: Use `refs` to connect transitions to the requirements they implement
4. **Update requirements**: Make requirements reference state machine elements for precision

## Tooling

- XSLT/XQuery templates for visualizing state machines as diagrams
- Validation rules to check state machine well-formedness (reachability, determinism)
- Code generators for common languages/frameworks

# Alternatives considered

## Alternative 1: Embed states in entity definition

```xml
<entity id="ENT-ORDER" name="Order">
  <states initial="pending">
    <state name="pending"/>
    <state name="confirmed"/>
    ...
  </states>
</entity>
```

**Rejected because:**
- Couples state machine to entity too tightly
- Some state machines span multiple entities or represent processes
- Harder to reuse state machine patterns

## Alternative 2: Use existing scenarios for state sequences

Encode state machines as scenarios with specific narrative format.

**Rejected because:**
- Scenarios are for user journeys, not formal state specifications
- No structured way to express guards, actions, or completeness
- Mixing concerns reduces clarity

## Alternative 3: Full UML Statechart support

Include hierarchical states, history states, orthogonal regions, etc.

**Rejected because:**
- Excessive complexity for most use cases
- Harder for LLMs to interpret reliably
- Can be added in future RFC if needed

## Alternative 4: External state machine reference

Just reference external files (e.g., SCXML, XState JSON).

**Rejected because:**
- Loses the "self-contained" benefit of RQML
- Different tools use different formats
- Harder to trace to requirements

# Open questions

1. **Should transitions between state machines be supported?** (e.g., order completion triggers payment settlement) - probably better handled via events/trace edges

2. **Should we support parallel states (AND-states)?** This would enable modeling concurrent aspects but adds complexity

3. **Should guards have a more structured format?** Currently free text; could use a simple expression language

4. **Naming: `behavior` vs `dynamics` vs `lifecycles`?** - `behavior` aligns with UML terminology

5. **Should `stateMachine` be allowed inside `domain` near its entity?** - Current proposal keeps sections separate for consistency

# Security / safety / misuse considerations

## Safety-critical systems

State machines are valuable for safety-critical systems but this RFC does not include:
- Safety integrity levels on states/transitions
- Formal verification hooks
- Fault tolerance patterns

These could be added via profiles or a future RFC for safety-critical extensions.

## Ambiguity risks

- Free-text guards could be ambiguous; authors should strive for precision
- Missing transitions may indicate specification gaps; tooling should warn about unreachable states
- Non-deterministic transitions (same event, multiple targets without guards) should be flagged

# Reference implementation (optional)

To be developed. Suggested scope:
- XSD schema fragment (included above)
- XSLT to generate PlantUML/Mermaid state diagrams
- Example TypeScript code generator
- Validation script for well-formedness checks

# Decision record

- Status: Draft
- Maintainer decision date: (pending)
- Rationale: (pending)
