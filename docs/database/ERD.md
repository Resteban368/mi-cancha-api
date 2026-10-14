<!-- Archivo generado por prisma/erd/generator.ts. No editar a mano: se regenera con `prisma generate`. -->

# Diagrama de la base de datos

Fuente: `prisma/schema.prisma`. Versión navegable: [erd.html](./erd.html).

```mermaid
erDiagram
  User {
    String id PK
    String email UK "opcional"
    String passwordHash "opcional"
    String displayName
    String phone "opcional"
    UserRole role
    Boolean verified
    String googleSub UK "opcional"
    String appleSub UK "opcional"
    DateTime createdAt
    DateTime updatedAt
  }
  Business {
    String id PK
    String ownerId FK, UK
    String name
    String address
    String neighborhood
    String description "opcional"
    DateTime createdAt
    DateTime updatedAt
  }
  BusinessProfileImage {
    String id PK
    String businessId FK, UK
    String storagePath "Ruta del archivo dentro del almacenamiento, p. ej. mi-cancha/business-profile/<negocio>/<id>.jpg"
    String contentType
    Int sizeBytes
    DateTime createdAt
    DateTime updatedAt
  }
  Court {
    String id PK
    String businessId FK
    String name
    Sport sport
    Int hourlyPrice "Precio por hora en pesos colombianos (COP, sin decimales)."
    Boolean active
    DateTime createdAt
    DateTime updatedAt
  }
  Reservation {
    String id PK
    String businessId FK
    String courtId FK
    String playerId FK "opcional"
    DateTime start
    DateTime end
    String customerName
    String customerDetail "opcional"
    String phone
    String contactNote "opcional"
    String tag "opcional"
    Boolean isRecurring
    Int totalPrice "Valor total en COP."
    ReservationStatus status
    DateTime createdAt
    DateTime updatedAt
  }
  Payment {
    String id PK
    String businessId FK
    String reservationId FK "opcional"
    String customerName
    Int amount "Monto en COP."
    String methodId FK
    PaymentConcept concept
    PaymentStatus status
    String reference "opcional"
    String note "opcional"
    String rejectionReason "opcional"
    Boolean registeredByBusiness
    DateTime receivedAt
    DateTime updatedAt
  }
  Amenity {
    String id PK
    String code UK "Código estable que usan la API y la app (p. ej. PARQUEADERO)."
    String name
    Boolean active
    Int sortOrder
    DateTime createdAt
    DateTime updatedAt
  }
  PaymentMethod {
    String id PK
    String code UK "Código estable que usan la API y la app (p. ej. NEQUI)."
    String name
    Boolean requiresReference "Si al registrar el pago se exige número de referencia o comprobante."
    Boolean active
    Int sortOrder
    DateTime createdAt
    DateTime updatedAt
  }
  Plan {
    String id PK
    String name UK
    Int monthlyPrice "Precio mensual en COP."
    Int courtLimit
    Json benefits "Lista de { title, detail }."
  }
  Subscription {
    String id PK
    String businessId FK, UK
    String planId FK
    DateTime since
    DateTime nextPayment
    Boolean isActive
    Boolean autoBilling
  }
  User ||--o| Business : "business"
  Business ||--o| BusinessProfileImage : "profileImage"
  Business ||--o{ Court : "courts"
  Business ||--o{ Reservation : "reservations"
  Court ||--o{ Reservation : "reservations"
  User |o--o{ Reservation : "reservations"
  Business ||--o{ Payment : "payments"
  Reservation |o--o{ Payment : "payments"
  PaymentMethod ||--o{ Payment : "payments"
  Amenity }o--o{ Business : "AmenityToBusiness"
  Business ||--o| Subscription : "subscription"
  Plan ||--o{ Subscription : "subscriptions"
```

**Leyenda:** PK llave primaria · FK llave foránea · UK única · `||` exactamente uno · `|o` cero o uno · `o{` cero o muchos · `}o--o{` muchos a muchos.

## Enums

| Enum | Valores |
|---|---|
| `UserRole` | `SUPER_ADMIN`, `ADMIN_NEGOCIO`, `JUGADOR` |
| `Sport` | `FUTBOL`, `PADEL`, `BALONCESTO`, `VOLEIBOL` |
| `ReservationStatus` | `CONFIRMED`, `COMPLETED`, `NO_SHOW`, `CANCELLED` |
| `PaymentConcept` | `ANTICIPO`, `SALDO`, `TOTAL` |
| `PaymentStatus` | `PENDING`, `APPROVED`, `REJECTED` |

## Únicos compuestos

- Court: (businessId, name)
