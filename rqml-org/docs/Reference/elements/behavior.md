---
id: element-behavior
title: behavior
description: State machines, states, and transitions for entity lifecycles.
---

## Summary
Optional section to define state machines that model entity lifecycles and workflow states.

## Where it appears
- `rqml > behavior`

## Content model
- `stateMachine` (0..n)

`stateMachine` children:
- `description` (0..1)
- `state` (1..n)
- `transition` (0..n)

`state` children:
- `description` (0..1)
- `onEntry` (0..1)
- `onExit` (0..1)
- `invariant` (0..1)

`transition` children:
- `description` (0..1)
- `trigger` (0..1)
- `guard` (0..1)
- `action` (0..1)
- `refs` (0..1) → `ref` (0..n)

## Attributes

`stateMachine`:
- `id` (IdType, required)
- `name` (string, required)
- `entityRef` (IdType, optional) — references a domain entity
- `initial` (IdType, required) — references the initial state

`state`:
- `id` (IdType, required)
- `name` (string, required)
- `type` (StateKindType, optional, default: `normal`) — one of `initial`, `normal`, `final`

`transition`:
- `id` (IdType, required)
- `from` (IdType, required) — references source state
- `to` (IdType, required) — references target state
- `event` (string, optional) — event name that triggers this transition

## Example (minimal)
```xml
<behavior>
  <stateMachine id="SM-DOC" name="Document Status" initial="ST-DRAFT">
    <state id="ST-DRAFT" name="Draft" type="initial"/>
    <state id="ST-PUBLISHED" name="Published" type="final"/>
    <transition id="TR-PUBLISH" from="ST-DRAFT" to="ST-PUBLISHED" event="publish"/>
  </stateMachine>
</behavior>
```

## Example (typical)
```xml
<behavior>
  <stateMachine id="SM-ORDER" name="Order Lifecycle" entityRef="ENT-ORDER" initial="ST-PENDING">
    <description>Valid state transitions for an Order.</description>

    <state id="ST-PENDING" name="Pending" type="initial">
      <description>Order created but not confirmed</description>
      <invariant>Payment not captured</invariant>
    </state>

    <state id="ST-CONFIRMED" name="Confirmed">
      <description>Order confirmed, payment authorized</description>
      <onEntry>Send confirmation email</onEntry>
    </state>

    <state id="ST-SHIPPED" name="Shipped">
      <onEntry>Capture payment; send tracking info</onEntry>
    </state>

    <state id="ST-DELIVERED" name="Delivered" type="final"/>

    <state id="ST-CANCELLED" name="Cancelled" type="final">
      <onEntry>Release authorization; restore inventory</onEntry>
    </state>

    <transition id="TR-CONFIRM" from="ST-PENDING" to="ST-CONFIRMED" event="confirm">
      <guard>Payment authorization successful</guard>
      <action>Reserve inventory</action>
      <refs><ref ref="REQ-ORDER-CONFIRM"/></refs>
    </transition>

    <transition id="TR-SHIP" from="ST-CONFIRMED" to="ST-SHIPPED" event="ship">
      <guard>All items packed</guard>
    </transition>

    <transition id="TR-DELIVER" from="ST-SHIPPED" to="ST-DELIVERED" event="deliver"/>

    <transition id="TR-CANCEL-1" from="ST-PENDING" to="ST-CANCELLED" event="cancel"/>

    <transition id="TR-CANCEL-2" from="ST-CONFIRMED" to="ST-CANCELLED" event="cancel">
      <guard>Not yet shipped</guard>
    </transition>
  </stateMachine>
</behavior>
```

## Notes / LLM hints
- Use `entityRef` to link a state machine to the domain entity whose lifecycle it models.
- The `initial` attribute must reference a state defined in the same state machine.
- States with `type="final"` should have no outgoing transitions.
- Use `guard` for conditions and `action` for side effects on transitions.
- Link transitions to requirements via `refs` for traceability.
- Generate state enums from state names; generate transition validators from the transition list.
