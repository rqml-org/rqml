import React, {useState} from 'react';
import CodeBlock from '@theme/CodeBlock';
import styles from './styles.module.css';

type Tag = {
  id: string;
  label: string;
  description: string;
  required?: boolean;
  snippet: string;
};

const TAGS: Tag[] = [
  {
    id: 'meta',
    label: 'meta',
    description: 'Document identity and metadata',
    required: true,
    snippet: `<meta>
  <title>DriveEasy Car Rental Platform - Software Requirements Specification</title>
  <system>DriveEasy</system>
  <summary>
    A web-based system for searching, reserving, picking up, and returning
    rental vehicles across multiple branch locations.
  </summary>
  <authors>
    <author>
      <name>Anna Sigurdsson</name>
      <role>Product Owner</role>
      <org>DriveEasy ehf.</org>
    </author>
  </authors>
  <dates>
    <created>2026-01-15</created>
    <updated>2026-02-20</updated>
    <targetRelease>v1.0.0 - 2026-Q3</targetRelease>
  </dates>
  <profiles>
    <profile id="PROF-GDPR" type="compliance">
      <description>GDPR compliance for personal data processing.</description>
    </profile>
  </profiles>
</meta>`,
  },
  {
    id: 'catalogs',
    label: 'catalogs',
    description: 'Shared definitions and reusable lists',
    snippet: `<catalogs>
  <glossary>
    <term id="TERM-RESERVATION">
      <name>Reservation</name>
      <definition>
        A confirmed booking that allocates a vehicle category for a customer
        during a specific date range at a designated branch location.
      </definition>
      <synonyms><synonym>Booking</synonym></synonyms>
    </term>
  </glossary>
  <actors>
    <actor id="ACT-CUSTOMER" name="Customer" type="human">
      <description>
        A person who searches for vehicles, makes reservations, picks up
        and returns rental cars.
      </description>
    </actor>
    <actor id="ACT-PAYMENT-GW" name="Payment Gateway" type="system">
      <description>External payment processing system (Stripe).</description>
    </actor>
  </actors>
</catalogs>`,
  },
  {
    id: 'domain',
    label: 'domain',
    description: 'Domain context and terminology',
    snippet: `<domain>
  <overview>
    The DriveEasy domain models customers, vehicles, branches, and the
    reservations and rental agreements that connect them.
  </overview>
  <entities>
    <entity id="ENT-VEHICLE" name="Vehicle">
      <description>
        A physical car in the fleet. Assigned to a branch and a category.
      </description>
      <attr id="ATTR-VEH-VIN" name="vin" type="string" required="true">
        <description>Vehicle Identification Number (17 characters).</description>
        <constraints>Exactly 17 alphanumeric characters per ISO 3779.</constraints>
      </attr>
      <attr id="ATTR-VEH-STATUS" name="status"
            type="enum:available,rented,maintenance,retired" required="true">
        <description>Current operational status of the vehicle.</description>
      </attr>
    </entity>
  </entities>
</domain>`,
  },
  {
    id: 'goals',
    label: 'goals',
    description: 'The "why": business and quality goals',
    snippet: `<goals>
  <goal id="GOAL-ONLINE-BOOKING" title="Enable Online Self-Service Booking"
        priority="must" status="approved" ownerRef="STK-PRODUCT">
    <statement>
      Achieve a fully digital reservation flow so that customers can search,
      compare, and book rental vehicles online.
    </statement>
    <rationale>
      78% of car rentals are researched online. An online booking channel
      reduces branch workload and enables 24/7 reservations.
    </rationale>
  </goal>

  <qgoal id="QGOAL-AVAILABILITY" title="High Availability"
         priority="must" status="approved">
    <statement>The booking platform SHALL be available 24/7.</statement>
    <metric>99.9% uptime measured monthly, excluding planned maintenance.</metric>
  </qgoal>
</goals>`,
  },
  {
    id: 'scenarios',
    label: 'scenarios',
    description: 'Narrative use cases and user journeys',
    snippet: `<scenarios>
  <scenario id="SCN-RESERVE" title="Make an Online Reservation"
            actorRef="ACT-CUSTOMER">
    <narrative>
      1. Customer selects a vehicle category from search results.
      2. System displays pricing breakdown (base rate, taxes, fees).
      3. System offers optional extras (CDW, GPS, child seat).
      4. Customer enters personal and payment details.
      5. System creates a pre-authorization hold on the customer's card.
      6. System confirms availability with a pessimistic lock and creates the reservation.
      7. System generates a confirmation code and sends confirmation email.
    </narrative>
  </scenario>
</scenarios>`,
  },
  {
    id: 'requirements',
    label: 'requirements',
    description: 'The "what": normative requirement statements',
    required: true,
    snippet: `<requirements>
  <reqPackage id="PKG-RES" title="Reservation Management" ownerRef="STK-PRODUCT">
    <req id="REQ-RES-003" type="FR" title="Concurrency-Safe Availability Check"
         status="approved" priority="must" appliesTo="ENT-RESERVATION">
      <statement>
        The system SHALL use pessimistic locking when creating a reservation
        to prevent overbooking of the last available vehicle in a category.
      </statement>
      <rationale>Prevents double-booking race conditions under load.</rationale>
      <acceptance>
        <criterion id="AC-RES-003-1">
          <given>Only one vehicle remains in a category for the requested dates.</given>
          <when>Two customers simultaneously attempt to reserve that category.</when>
          <then>Exactly one reservation succeeds; the other receives a "not available" error.</then>
        </criterion>
      </acceptance>
    </req>
  </reqPackage>
</requirements>`,
  },
  {
    id: 'behavior',
    label: 'behavior',
    description: 'State machines and lifecycle transitions',
    snippet: `<behavior>
  <stateMachine id="SM-RESERVATION" name="Reservation Lifecycle"
                entityRef="ENT-RESERVATION" initial="ST-RES-PENDING">
    <state id="ST-RES-PENDING" name="Pending" type="initial">
      <description>Reservation created, awaiting payment authorization.</description>
      <onEntry>Generate confirmation code. Start 15-minute payment timeout.</onEntry>
    </state>
    <state id="ST-RES-CONFIRMED" name="Confirmed" type="normal">
      <description>Payment authorized; reservation is active.</description>
      <invariant>Pre-authorization hold is active on customer's card.</invariant>
    </state>

    <transition id="TR-RES-CONFIRM" from="ST-RES-PENDING" to="ST-RES-CONFIRMED"
                event="paymentAuthorized">
      <guard>Stripe pre-authorization succeeds. Vehicle still available.</guard>
      <action>Persist reservation. Decrement available inventory count.</action>
    </transition>
  </stateMachine>
</behavior>`,
  },
  {
    id: 'interfaces',
    label: 'interfaces',
    description: 'APIs, UIs, integrations, and data contracts',
    snippet: `<interfaces>
  <api id="API-CUSTOMER" name="Customer API" protocol="https" auth="jwt">
    <description>
      Public-facing REST API for the customer web and mobile applications.
    </description>

    <endpoint id="EP-CREATE-RES" method="POST" path="/api/v1/reservations">
      <summary>Create a new reservation.</summary>
      <request>
        JSON body with categoryId, branches, dates, extras, paymentMethodId.
        Requires: authenticated customer.
      </request>
      <response>
        201 Created: Reservation object with confirmationCode, status, totalPrice.
      </response>
      <errors>
        402 Payment Required: Payment authorization failed.
        409 Conflict: Vehicle category no longer available.
      </errors>
    </endpoint>
  </api>
</interfaces>`,
  },
  {
    id: 'verification',
    label: 'verification',
    description: 'Tests, acceptance criteria, and inspections',
    snippet: `<verification>
  <testSuite id="TS-RESERVATION" title="Reservation Test Suite">
    <description>Tests for reservation lifecycle and concurrency.</description>
  </testSuite>

  <testCase id="TC-RES-002" type="acceptance"
            title="Create reservation with valid data">
    <purpose>Verify end-to-end reservation creation with payment auth.</purpose>
    <steps>
      1. Authenticate as test customer.
      2. POST /api/v1/reservations with valid data and Stripe test card.
      3. Verify response is 201 with confirmationCode.
      4. Verify reservation status is "confirmed" in database.
      5. Verify Stripe pre-authorization was created for correct amount.
    </steps>
    <expected>
      Reservation created. Pre-authorization matches total price.
      Confirmation email delivered within 60 seconds.
    </expected>
  </testCase>
</verification>`,
  },
  {
    id: 'trace',
    label: 'trace',
    description: 'Traceability across goals, requirements, and tests',
    snippet: `<trace>
  <edge id="TRC-001" type="satisfies" from="REQ-RES-001" to="GOAL-ONLINE-BOOKING"
        confidence="1.0" status="approved">
    <notes>Vehicle search is the entry point for online booking.</notes>
  </edge>

  <edge id="TRC-012" type="mitigates" from="REQ-RES-003" to="RISK-OVERBOOKING"
        confidence="0.9" status="approved"/>

  <edge id="TRC-020" type="verifiedBy" from="REQ-RES-001" to="TC-RES-001"
        confidence="1.0" status="approved"/>
</trace>`,
  },
  {
    id: 'governance',
    label: 'governance',
    description: 'Ownership, approvals, and change control',
    snippet: `<governance>
  <issue id="ISS-DAMAGE-WORKFLOW" status="draft" owner="Bjarki Thorsson">
    <statement>
      The damage assessment and claims workflow at vehicle return needs
      further clarification. How are damage charges disputed? How are
      insurance claims (CDW) integrated with the damage workflow?
    </statement>
    <notes>Meeting scheduled with operations team for 2026-03-01.</notes>
  </issue>

  <approval id="APR-ARCHITECTURE" role="Lead Architect" status="approved">
    <description>
      Architecture approval of technology stack, integration decisions,
      and non-functional requirements. Approved by Bjarki Thorsson on 2026-02-15.
    </description>
  </approval>
</governance>`,
  },
];

export default function RqmlTagExplorer(): JSX.Element {
  const [activeId, setActiveId] = useState<string>(TAGS[0].id);
  const active = TAGS.find((t) => t.id === activeId) ?? TAGS[0];

  return (
    <>
    <div className={styles.explorer}>
      <ul
        className={styles.tabList}
        role="tablist"
        aria-label="RQML top-level tags"
      >
        {TAGS.map((tag) => {
          const isActive = tag.id === activeId;
          return (
            <li key={tag.id} className={styles.tabItem}>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="rqml-snippet-panel"
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={() => setActiveId(tag.id)}
              >
                <span className={styles.tabHeader}>
                  <span className={styles.tabName}>&lt;{tag.label}&gt;</span>
                  {tag.required && (
                    <span className={styles.requiredBadge}>required</span>
                  )}
                </span>
                <span className={styles.tabDescription}>{tag.description}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div
        id="rqml-snippet-panel"
        className={styles.snippet}
        role="tabpanel"
        aria-label={`${active.label} snippet`}
      >
        <CodeBlock
          language="xml"
          title={`<${active.label}>`}
          showLineNumbers
        >
          {active.snippet}
        </CodeBlock>
      </div>
    </div>
    <p className={styles.legend}>
      Only <code>&lt;meta&gt;</code> and <code>&lt;requirements&gt;</code> are
      required — the other nine sections are optional, added when they earn their keep.
    </p>
    </>
  );
}
