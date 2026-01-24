---
id: behavior
title: Behavior
sidebar_position: 7
description: Model entity lifecycles and workflows with state machines.
---

The optional `behavior` section captures state machines that define valid lifecycles for entities and processes. This enables precise specification of allowed states and transitions.

## Structure
- `stateMachine`: A named state machine with `@id`, `name`, optional `entityRef` (links to a domain entity), and required `@initial` (references the starting state).
- `state`: Individual states with `@id`, `name`, optional `type` (`initial`/`normal`/`final`), and optional `description`, `onEntry`, `onExit`, `invariant`.
- `transition`: Edges between states with `@id`, `from`, `to`, optional `event`, and optional `description`, `trigger`, `guard`, `action`, `refs`.

## When to use state machines

Use the behavior section when:
- An entity has a **status field** that changes over time (orders, payments, tickets, users)
- There are **rules about valid transitions** (can't ship a cancelled order)
- **Different actions** happen at different lifecycle stages (send email on confirmation)
- You need to **generate state management code** (enums, transition validators, event handlers)

## Authoring tips
- Link state machines to domain entities via `entityRef` to clarify which entity's lifecycle is modeled.
- Use `guard` to specify conditions that must be true for a transition to fire.
- Use `action` to document side effects that occur during a transition.
- Use `refs` on transitions to link to requirements they implement, enabling traceability.
- Ensure every non-final state has at least one outgoing transition (no dead ends).
- Mark terminal states with `type="final"` to indicate completed lifecycles.

## Example
```xml
<behavior>
  <stateMachine id="SM-ORDER" name="Order Lifecycle" entityRef="ENT-ORDER" initial="ST-PENDING">
    <description>Valid state transitions for an Order from creation to completion.</description>

    <!-- States -->
    <state id="ST-PENDING" name="Pending" type="initial">
      <description>Order created but not yet confirmed</description>
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
```

## Code generation examples

LLMs can generate the following from state machine definitions:

**State enum/type:**
```typescript
enum OrderStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}
```

**Transition validator:**
```typescript
const ORDER_TRANSITIONS = [
  { from: 'pending', to: 'confirmed', event: 'confirm' },
  { from: 'confirmed', to: 'shipped', event: 'ship' },
  { from: 'shipped', to: 'delivered', event: 'deliver' },
  { from: 'pending', to: 'cancelled', event: 'cancel' },
  { from: 'confirmed', to: 'cancelled', event: 'cancel' },
];

function canTransition(currentState: string, event: string): boolean {
  return ORDER_TRANSITIONS.some(t => t.from === currentState && t.event === event);
}
```

## Test generation examples

State machines enable systematic test generation:

1. **Happy path**: Test the main flow from initial to final state
2. **All transitions**: Test each defined transition at least once
3. **Invalid transitions**: Verify that undefined transitions are rejected
4. **Guard conditions**: Test transitions with guards both satisfied and unsatisfied
5. **State coverage**: Ensure all states are reachable in tests

## Theory
- State machines formalize entity lifecycles, reducing ambiguity about valid sequences—aligned with UML behavioral modeling.
- Guards and actions capture business logic tied to state changes, supporting precise code generation.
- Linking transitions to requirements via `refs` maintains traceability per IEEE 29148.
- Explicit lifecycles improve testability by defining the complete set of valid state sequences.
- Bibliography: [UML State Machine Diagrams](https://www.uml-diagrams.org/state-machine-diagrams.html), [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [Statecharts (Harel)](https://www.sciencedirect.com/science/article/pii/0167642387900359).
