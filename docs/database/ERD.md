<!-- Archivo generado por prisma/erd/generator.ts. No editar a mano: se regenera con `prisma generate`. -->

# Diagrama de la base de datos

Fuente: `prisma/schema.prisma`. Versión navegable: [erd.html](./erd.html).

```mermaid
erDiagram
  User {
    String id PK
    String email UK "opcional"
    String passwordHash "opcional"
    Boolean mustChangePassword "La cuenta la creó un negocio al registrar al cliente y su clave inicial es la cédula: debe
cambiarla (y aceptar la política de datos) en su primer ingreso."
    String displayName
    String phone "opcional"
    UserRole role
    Boolean verified
    String googleSub UK "opcional · Identificador de la cuenta de Google del jugador."
    String appleSub UK "opcional · Identificador de la cuenta de Apple del jugador."
    String documentId UK "opcional · Cédula del jugador (sin puntos); con el celular sirve para iniciar sesión."
    DateTime birthDate "opcional"
    Sport favoriteSport "opcional"
    DateTime dataConsentAt "opcional · Aceptación de la política de tratamiento de datos (Ley 1581) y su versión."
    String dataConsentVersion "opcional"
    DateTime emailVerifiedAt "opcional · Previsto para verificar correo y celular con un código (aún no se usa)."
    DateTime phoneVerifiedAt "opcional"
    DateTime bannedAt "opcional · Cuándo el super admin bloqueó la cuenta; null = activa. Una cuenta bloqueada no puede
iniciar sesión ni usar la API (sus tokens dejan de valer)."
    String bannedReason "opcional · Motivo que escribió el super admin al bloquearla."
    String bannedById "opcional · Super admin que la bloqueó (sin llave foránea: el dato sobrevive si se borra esa cuenta)."
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
    Float latitude "opcional · Punto de llegada (WGS84). Ambos nulos si aún no se fijó en el mapa."
    Float longitude "opcional"
    String slug UK "opcional · Identificador del link público de reservas: /reservar/<slug>. Lo genera un
trigger de la base a partir del nombre al crear el negocio (nunca queda nulo)."
    Boolean onlineBookingEnabled "Si el link público acepta reservas de jugadores."
    Boolean salesModuleEnabled "Módulo de Ventas (productos, consumos, ventas sueltas y caja). Lo activa el super admin."
    DateTime salesModuleEnabledAt "opcional"
    String cityId FK "opcional · Ciudad (municipio de Colombia); de ella sale el departamento. Obligatoria al crear el negocio
(los anteriores a este campo quedan en null hasta que la completen)."
    DateTime createdAt
    DateTime updatedAt
  }
  Department {
    String id PK
    String code UK "Código DANE de 2 dígitos, p. ej. 05 (Antioquia)."
    String name
  }
  City {
    String id PK
    String code UK "Código DANE de 5 dígitos, p. ej. 05001 (Medellín)."
    String name
    String departmentId FK
  }
  BusinessProfileImage {
    String id PK
    String businessId FK
    String storagePath "Ruta del archivo dentro del almacenamiento, p. ej. mi-cancha/business-profile/<negocio>/<id>.jpg"
    String contentType
    Int sizeBytes
    Int position "Orden dentro del negocio, desde 0; la 0 es la portada."
    DateTime createdAt
    DateTime updatedAt
  }
  Court {
    String id PK
    String businessId FK
    String name
    Sport sport
    Boolean isCovered "true = cubierta o con techo; false = al aire libre."
    String currency "Código ISO 4217 de la moneda de los precios (COP, USD…)."
    Decimal basePricePerHour "Precio por hora cuando ninguna tarifa (CourtRate) cubre la franja."
    Int slotDuration "Duración de cada turno en minutos: 30, 60, 90 o 120."
    String surfaceId FK "opcional · Superficie o tipo de grama (catálogo); null si no se indicó."
    Decimal lengthMeters "opcional · Medidas en metros. Van las dos o ninguna."
    Decimal widthMeters "opcional"
    Int playersPerSide "opcional · Formato: jugadores por equipo (5 en fútbol 5, 2 en pádel); null si no se indicó."
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  SlotHold {
    String id PK
    String businessId FK
    String courtId FK
    String playerId FK
    DateTime start "Inicio del primer turno y fin del último."
    DateTime end
    Int slots
    DateTime expiresAt
    DateTime createdAt
    DateTime updatedAt
  }
  CourtSchedule {
    String id PK
    String courtId FK
    DayOfWeek dayOfWeek
    Boolean isOpen
    String openTime "opcional · Hora local HH:mm; null si está cerrado."
    String closeTime "opcional · Hora local HH:mm; null si está cerrado."
  }
  CourtRate {
    String id PK
    String courtId FK
    String name
    Decimal pricePerHour
    DayOfWeek[] days "Días en los que empieza la franja."
    String startTime "Hora local HH:mm. Si endTime es menor, la franja termina al día siguiente."
    String endTime
    Int sortOrder
  }
  CourtPhoto {
    String id PK
    String courtId FK
    CourtPhotoSlot slot
    String storagePath "Ruta del archivo en el almacenamiento, p. ej. mi-cancha/courts/<cancha>/<id>.jpg"
    String contentType
    Int sizeBytes
    DateTime createdAt
  }
  Reservation {
    String id PK
    String businessId FK
    String courtId FK
    String playerId FK "opcional"
    String customerId FK "opcional · Cliente del negocio; null en reservas anteriores a la tabla de clientes."
    DateTime start
    DateTime end
    String customerName "Nombre y teléfono del cliente al momento de reservar."
    String customerDetail "opcional"
    String phone
    String contactNote "opcional"
    String tag "opcional"
    Boolean isRecurring
    ReservationSource source "BUSINESS si la creó el negocio o el super admin; WEB si la creó el jugador."
    Decimal subtotal "Valor según las tarifas, antes del descuento."
    Decimal discount
    Decimal totalPrice "subtotal - discount, en la moneda de la cancha."
    Decimal consumptionsTotal "Suma de las ventas activas cargadas a la reserva (bebidas, snacks…). El saldo es
totalPrice + consumptionsTotal - pagos aprobados. Se actualiza con cada venta."
    ReservationStatus status
    String groupId FK "opcional · Reserva de varias canchas a la vez: las del mismo grupo comparten franja,
se pagan y se cancelan juntas. null = reserva de una sola cancha."
    String cancellationReason "opcional"
    DateTime cancelledAt "opcional"
    String cancelledById FK "opcional"
    DateTime createdAt
    DateTime updatedAt
  }
  ReservationGroup {
    String id PK
    String businessId FK
    DateTime createdAt
  }
  Customer {
    String id PK
    String businessId FK
    String name
    String phone
    String documentId "opcional · Número de cédula u otro documento de identidad. null solo en clientes que
llegaron por la web y aún no la registran (el negocio siempre la pide)."
    Sport preferredSport "opcional · Deporte habitual elegido por el negocio; si es null se usa el más reservado."
    String notes "opcional · Notas internas del negocio (no las ve el cliente)."
    String userId FK "opcional · Cuenta de jugador vinculada (si se registró en la web)."
    DateTime createdAt
    DateTime updatedAt
  }
  Refund {
    String id PK
    String businessId FK
    String reservationId FK
    String paymentId FK, UK
    String customerId FK "opcional"
    Decimal amount
    String reason "Motivo de la cancelación que originó la devolución."
    String createdById FK "opcional"
    DateTime createdAt
  }
  Payment {
    String id PK
    String businessId FK
    String reservationId FK "opcional"
    String customerName
    Decimal amount "Monto en la moneda del negocio, con hasta 2 decimales."
    String methodId FK
    PaymentConcept concept
    PaymentStatus status
    String reference "opcional"
    String note "opcional"
    String rejectionReason "opcional"
    Boolean registeredByBusiness
    String saleId FK, UK "opcional · Venta suelta que se pagó con este pago (concepto VENTA)."
    DateTime receivedAt
    DateTime updatedAt
  }
  Product {
    String id PK
    String businessId FK
    String name
    ProductCategory category
    Decimal price "Precio por unidad en la moneda del negocio."
    Boolean isActive
    Boolean trackStock "Con el módulo de Inventario: si se controlan sus existencias."
    Int stock "Unidades disponibles (solo cuenta si trackStock)."
    Int minStock "opcional · Alerta de stock bajo cuando stock <= minStock (null = sin alerta)."
    DateTime createdAt
    DateTime updatedAt
  }
  Sale {
    String id PK
    String businessId FK
    String reservationId FK "opcional"
    String customerName "opcional · A quién se le vendió (en una venta suelta es opcional)."
    Decimal total
    String note "opcional"
    SaleStatus status
    String voidReason "opcional"
    DateTime voidedAt "opcional"
    String createdById "opcional · Quién la registró (sin llave foránea: el dato sobrevive si se borra la cuenta)."
    DateTime createdAt
  }
  SaleItem {
    String id PK
    String saleId FK
    String productId FK "opcional"
    String productName
    Decimal unitPrice
    Int quantity
    Decimal subtotal
  }
  CashSession {
    String id PK
    String businessId FK
    Decimal openingCash "Efectivo con que se abrió la caja."
    String openingNote "opcional"
    DateTime openedAt
    String openedById "opcional · Quién la abrió y quién la cerró (sin llave foránea: el dato sobrevive si se borra la cuenta)."
    String openedByName "opcional"
    DateTime closedAt "opcional"
    String closedById "opcional"
    String closedByName "opcional"
    Decimal expectedCash "opcional · Al cerrar: base + pagos aprobados en efectivo del turno."
    Decimal countedCash "opcional · Efectivo contado al cerrar."
    Decimal difference "opcional · countedCash - expectedCash (negativo = faltante)."
    String closingNote "opcional"
    Json summary "opcional · Pagos aprobados del turno por método al cerrar: [{ code, name, count, amount }]."
  }
  CashMovement {
    String id PK
    String businessId FK
    String sessionId FK
    CashMovementType type
    Decimal amount
    String reason "Por qué (p. ej. 'Consignación Bancolombia', 'Monedas para cambio')."
    String createdById "opcional"
    String createdByName "opcional"
    DateTime createdAt
    DateTime voidedAt "opcional"
    String voidReason "opcional"
  }
  StockMovement {
    String id PK
    String businessId FK
    String productId FK
    StockMovementType type
    Int quantity "Unidades que entran (+) o salen (−)."
    Int stockAfter "Stock del producto después del movimiento."
    Decimal unitCost "opcional · Costo por unidad de una entrada (opcional)."
    String supplierId FK "opcional"
    String saleId "opcional"
    String note "opcional"
    String createdById "opcional"
    String createdByName "opcional"
    DateTime createdAt
  }
  Supplier {
    String id PK
    String businessId FK
    String name
    String documentId "opcional · NIT o cédula."
    String phone "opcional"
    String notes "opcional"
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  CashExpense {
    String id PK
    String businessId FK
    String sessionId FK
    String supplierId FK "opcional"
    String supplierName "Nombre del proveedor al momento del pago."
    Decimal amount
    String methodId FK
    String concept "Qué se pagó (p. ej. 'Pedido de bebidas')."
    String createdById "opcional"
    String createdByName "opcional"
    DateTime createdAt
    DateTime voidedAt "opcional"
    String voidReason "opcional"
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
  CourtSurface {
    String id PK
    String code UK "Código estable que usan la API y la app (p. ej. GRAMA_SINTETICA)."
    String name
    Sport[] sports "Deportes en los que se ofrece; vacío = todos."
    Boolean active
    Int sortOrder
    DateTime createdAt
    DateTime updatedAt
  }
  PaymentMethod {
    String id PK
    String code UK "Código estable que usan la API y la app (p. ej. NEQUI)."
    String name
    Boolean requiresReference "Si al registrar el pago se pide número de referencia o comprobante (opcional)."
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
    DateTime trialEndsAt "opcional · Fin de la prueba gratuita; null si el plan es de pago. Vencida la fecha, el negocio queda
como sin plan activo (solo consulta) hasta que se le asigne uno."
  }
  OtpCode {
    String id PK
    String phone "Celular en formato E.164 (+573001234567)."
    String codeHash
    String ipHash "opcional · HMAC de la IP que lo pidió: limita solicitudes por IP sin guardarla."
    DateTime expiresAt
    Int attempts
    DateTime usedAt "opcional · Cuándo se usó; un código usado no se acepta otra vez."
    DateTime createdAt
  }
  AuditLog {
    String id PK
    AuditCategory category
    String action "Código estable del evento, p. ej. client.created o player.login_failed."
    Boolean success "false en intentos rechazados (ingreso fallido, límite de códigos)."
    String actorId "opcional · Cuenta que lo hizo; null si no había sesión (p. ej. un ingreso fallido)."
    UserRole actorRole "opcional"
    String actorLabel "opcional · Nombre, correo o celular de quien lo hizo, como se veía en ese momento."
    String entityType "opcional · Sobre qué actuó: tipo (Business, User, Plan…) e id."
    String entityId "opcional"
    Json metadata "opcional · Detalle del evento (ruta, cambios, motivo). Nunca contraseñas, códigos ni tokens."
    String ipHash "opcional · HMAC de la IP (la misma de los códigos SMS); la IP real no se guarda."
    DateTime createdAt
  }
  PushSubscription {
    String id PK
    String userId FK
    String endpoint UK "URL del servicio push del navegador; única: si el navegador cambia de cuenta, pasa a la nueva."
    String p256dh "Claves de cifrado de la suscripción (PushSubscription.toJSON().keys)."
    String auth
    String userAgent "opcional"
    DateTime createdAt
    DateTime lastSeenAt
  }
  NotificationBroadcast {
    String id PK
    String imageId FK "opcional · Imagen opcional del aviso (se guarda en el almacenamiento de imágenes)."
    String sentById "Super admin que lo envió (sin llave foránea: el dato sobrevive si se borra la cuenta)."
    String sentByLabel "opcional · Nombre de quien lo envió al momento del envío."
    String title
    String body
    String url "opcional"
    String scope "ALL = todos los negocios; SELECTED = solo los elegidos."
    Int targeted "Negocios a los que iba dirigido."
    Int reachable "De ellos, cuántos tenían avisos activados en algún navegador."
    Int delivered "Navegadores que lo aceptaron."
    DateTime createdAt
  }
  Notification {
    String id PK
    String userId FK
    NotificationType type
    String title
    String body
    String url "opcional · Ruta de la app que se abre al tocarla."
    Json data "opcional · Datos para la app (p. ej. reservationId)."
    String broadcastId FK "opcional"
    String imageId FK "opcional"
    DateTime readAt "opcional · null = sin leer."
    DateTime createdAt
  }
  NotificationImage {
    String id PK
    String storagePath
    String contentType
    Int sizeBytes
    DateTime createdAt
  }
  User ||--o| Business : "business"
  City |o--o{ Business : "businesses"
  Department ||--o{ City : "cities"
  Business ||--o{ BusinessProfileImage : "profileImages"
  Business ||--o{ Court : "courts"
  CourtSurface |o--o{ Court : "courts"
  Business ||--o{ SlotHold : "slotHolds"
  Court ||--o{ SlotHold : "slotHolds"
  User ||--o{ SlotHold : "slotHolds"
  Court ||--o{ CourtSchedule : "schedules"
  Court ||--o{ CourtRate : "rates"
  Court ||--o{ CourtPhoto : "photos"
  Business ||--o{ Reservation : "reservations"
  Court ||--o{ Reservation : "reservations"
  User |o--o{ Reservation : "reservations"
  Customer |o--o{ Reservation : "reservations"
  ReservationGroup |o--o{ Reservation : "reservations"
  User |o--o{ Reservation : "cancelledReservations"
  Business ||--o{ ReservationGroup : "reservationGroups"
  Business ||--o{ Customer : "customers"
  User |o--o{ Customer : "customers"
  Business ||--o{ Refund : "refunds"
  Reservation ||--o{ Refund : "refunds"
  Payment ||--o| Refund : "refund"
  Customer |o--o{ Refund : "refunds"
  User |o--o{ Refund : "refunds"
  Business ||--o{ Payment : "payments"
  Reservation |o--o{ Payment : "payments"
  PaymentMethod ||--o{ Payment : "payments"
  Sale |o--o| Payment : "payment"
  Business ||--o{ Product : "products"
  Business ||--o{ Sale : "sales"
  Reservation |o--o{ Sale : "sales"
  Sale ||--o{ SaleItem : "items"
  Product |o--o{ SaleItem : "saleItems"
  Business ||--o{ CashSession : "cashSessions"
  Business ||--o{ CashMovement : "cashMovements"
  CashSession ||--o{ CashMovement : "movements"
  Business ||--o{ StockMovement : "stockMovements"
  Product ||--o{ StockMovement : "stockMovements"
  Supplier |o--o{ StockMovement : "stockMovements"
  Business ||--o{ Supplier : "suppliers"
  Business ||--o{ CashExpense : "cashExpenses"
  CashSession ||--o{ CashExpense : "expenses"
  Supplier |o--o{ CashExpense : "expenses"
  PaymentMethod ||--o{ CashExpense : "cashExpenses"
  Amenity }o--o{ Business : "AmenityToBusiness"
  Business ||--o| Subscription : "subscription"
  Plan ||--o{ Subscription : "subscriptions"
  User ||--o{ PushSubscription : "pushSubscriptions"
  NotificationImage |o--o{ NotificationBroadcast : "broadcasts"
  User ||--o{ Notification : "notifications"
  NotificationBroadcast |o--o{ Notification : "notifications"
  NotificationImage |o--o{ Notification : "notifications"
```

**Leyenda:** PK llave primaria · FK llave foránea · UK única · `||` exactamente uno · `|o` cero o uno · `o{` cero o muchos · `}o--o{` muchos a muchos.

## Tablas

### User

Cualquier persona que inicia sesión: super admin, administrador de negocio o jugador (según role).
Los negocios entran con email y contraseña; los jugadores con Google o Apple.

- **Business**: Puede tener un Business (campo business); la llave foránea está en Business.
- **PushSubscription**: Tiene cero o muchos PushSubscription (campo pushSubscriptions). Cada PushSubscription apunta a este User.
- **Notification**: Tiene cero o muchos Notification (campo notifications). Cada Notification apunta a este User.
- **Customer**: Tiene cero o muchos Customer (campo customers). Cada Customer apunta a este User.
- **Reservation**: Tiene cero o muchos Reservation (campo reservations). Cada Reservation apunta a este User.
- **Reservation**: Tiene cero o muchos Reservation (campo cancelledReservations). Cada Reservation apunta a este User.
- **Refund**: Tiene cero o muchos Refund (campo refunds). Cada Refund apunta a este User.
- **SlotHold**: Tiene cero o muchos SlotHold (campo slotHolds). Cada SlotHold apunta a este User.

### Business

La sede deportiva de un cliente. Cada administrador de negocio tiene exactamente una.

- **User**: Pertenece siempre a un User mediante ownerId; un User tiene como máximo un Business. Si se borra el User, se borra también su Business.
- **City**: Puede pertenecer a un City mediante cityId; un City puede tener varios Business. Si se borra el City, el Business se conserva sin City.
- **Amenity**: Muchos a muchos con Amenity: cada Business puede tener varios Amenity y cada Amenity puede estar en varios Business (campo amenities).
- **Court**: Tiene cero o muchos Court (campo courts). Cada Court apunta a este Business.
- **Customer**: Tiene cero o muchos Customer (campo customers). Cada Customer apunta a este Business.
- **Reservation**: Tiene cero o muchos Reservation (campo reservations). Cada Reservation apunta a este Business.
- **Payment**: Tiene cero o muchos Payment (campo payments). Cada Payment apunta a este Business.
- **Refund**: Tiene cero o muchos Refund (campo refunds). Cada Refund apunta a este Business.
- **Subscription**: Puede tener un Subscription (campo subscription); la llave foránea está en Subscription.
- **BusinessProfileImage**: Tiene cero o muchos BusinessProfileImage (campo profileImages). Cada BusinessProfileImage apunta a este Business.
- **SlotHold**: Tiene cero o muchos SlotHold (campo slotHolds). Cada SlotHold apunta a este Business.
- **ReservationGroup**: Tiene cero o muchos ReservationGroup (campo reservationGroups). Cada ReservationGroup apunta a este Business.
- **Product**: Tiene cero o muchos Product (campo products). Cada Product apunta a este Business.
- **Sale**: Tiene cero o muchos Sale (campo sales). Cada Sale apunta a este Business.
- **CashSession**: Tiene cero o muchos CashSession (campo cashSessions). Cada CashSession apunta a este Business.
- **Supplier**: Tiene cero o muchos Supplier (campo suppliers). Cada Supplier apunta a este Business.
- **CashExpense**: Tiene cero o muchos CashExpense (campo cashExpenses). Cada CashExpense apunta a este Business.
- **CashMovement**: Tiene cero o muchos CashMovement (campo cashMovements). Cada CashMovement apunta a este Business.
- **StockMovement**: Tiene cero o muchos StockMovement (campo stockMovements). Cada StockMovement apunta a este Business.

### Department

Departamento de Colombia (DIVIPOLA del DANE; 32 más Bogotá D.C.). Catálogo fijo cargado por migración.

- **City**: Tiene cero o muchos City (campo cities). Cada City apunta a este Department.

### City

Municipio de Colombia (DIVIPOLA del DANE). Catálogo fijo cargado por migración.

- **Department**: Pertenece siempre a un Department mediante departmentId; un Department puede tener varios City. No se puede borrar un Department mientras tenga City.
- **Business**: Tiene cero o muchos Business (campo businesses). Cada Business apunta a este City.

### BusinessProfileImage

Fotos del negocio (hasta 5). La de menor position es la portada que sale en el directorio;
el archivo vive en Koofr.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios BusinessProfileImage. Si se borra el Business, se borran también sus BusinessProfileImage.

### Court

Cancha que el negocio alquila por turnos. Solo recibe reservas si está activa (isActive) y
completa (tiene la foto MAIN). El límite del plan cuenta las activas.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Court. Si se borra el Business, se borran también sus Court.
- **CourtSurface**: Puede pertenecer a un CourtSurface mediante surfaceId; un CourtSurface puede tener varios Court. Si se borra el CourtSurface, el Court se conserva sin CourtSurface.
- **CourtSchedule**: Tiene cero o muchos CourtSchedule (campo schedules). Cada CourtSchedule apunta a este Court.
- **CourtRate**: Tiene cero o muchos CourtRate (campo rates). Cada CourtRate apunta a este Court.
- **CourtPhoto**: Tiene cero o muchos CourtPhoto (campo photos). Cada CourtPhoto apunta a este Court.
- **Reservation**: Tiene cero o muchos Reservation (campo reservations). Cada Reservation apunta a este Court.
- **SlotHold**: Tiene cero o muchos SlotHold (campo slotHolds). Cada SlotHold apunta a este Court.

### SlotHold

Turnos que un jugador apartó en la web mientras confirma la reserva. Vencen
solos (expiresAt). Un jugador tiene un solo apartado por negocio, de 1 a 3
canchas (una fila por cancha, todas con la misma franja).

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios SlotHold. Si se borra el Business, se borran también sus SlotHold.
- **Court**: Pertenece siempre a un Court mediante courtId; un Court puede tener varios SlotHold. Si se borra el Court, se borran también sus SlotHold.
- **User**: Pertenece siempre a un User mediante playerId; un User puede tener varios SlotHold. Si se borra el User, se borran también sus SlotHold.

### CourtSchedule

Horario de una cancha para un día de la semana. Siempre hay 7 por cancha.
Si closeTime es menor que openTime, la cancha cierra al día siguiente (p. ej. 18:00 a 02:00).

- **Court**: Pertenece siempre a un Court mediante courtId; un Court puede tener varios CourtSchedule. Si se borra el Court, se borran también sus CourtSchedule.

### CourtRate

Tarifa de una franja horaria (p. ej. nocturna). Reemplaza al precio base en esa franja;
una reserva que cruza franjas se cobra por fracciones. Las tarifas no se pueden cruzar.

- **Court**: Pertenece siempre a un Court mediante courtId; un Court puede tener varios CourtRate. Si se borra el Court, se borran también sus CourtRate.

### CourtPhoto

Foto de una cancha en una posición fija. El archivo vive en Koofr.

- **Court**: Pertenece siempre a un Court mediante courtId; un Court puede tener varios CourtPhoto. Si se borra el Court, se borran también sus CourtPhoto.

### Reservation

Un turno reservado en una cancha. La crea el negocio desde la app (o un jugador, en el futuro).

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Reservation. Si se borra el Business, se borran también sus Reservation.
- **Court**: Pertenece siempre a un Court mediante courtId; un Court puede tener varios Reservation. No se puede borrar un Court mientras tenga Reservation.
- **User**: Puede pertenecer a un User mediante playerId; un User puede tener varios Reservation. Si se borra el User, el Reservation se conserva sin User.
- **Customer**: Puede pertenecer a un Customer mediante customerId; un Customer puede tener varios Reservation. Si se borra el Customer, el Reservation se conserva sin Customer.
- **ReservationGroup**: Puede pertenecer a un ReservationGroup mediante groupId; un ReservationGroup puede tener varios Reservation. Si se borra el ReservationGroup, el Reservation se conserva sin ReservationGroup.
- **User**: Puede pertenecer a un User mediante cancelledById; un User puede tener varios Reservation. Si se borra el User, el Reservation se conserva sin User.
- **Payment**: Tiene cero o muchos Payment (campo payments). Cada Payment apunta a este Reservation.
- **Refund**: Tiene cero o muchos Refund (campo refunds). Cada Refund apunta a este Reservation.
- **Sale**: Tiene cero o muchos Sale (campo sales). Cada Sale apunta a este Reservation.

### ReservationGroup

Varias canchas (máximo 3) reservadas a la vez en la misma franja. Cada cancha
es una Reservation con este grupo; los pagos van en la primera reserva.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios ReservationGroup. Si se borra el Business, se borran también sus ReservationGroup.
- **Reservation**: Tiene cero o muchos Reservation (campo reservations). Cada Reservation apunta a este ReservationGroup.

### Customer

Dinero recibido por el negocio, normalmente ligado a una reserva. Los pagos por transferencia
Cliente de un negocio (quien reserva). Cada negocio tiene su propia lista;
teléfono y cédula son únicos dentro del negocio. El nivel de fidelidad no se
guarda: se calcula con sus reservas.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Customer. Si se borra el Business, se borran también sus Customer.
- **User**: Puede pertenecer a un User mediante userId; un User puede tener varios Customer. Si se borra el User, el Customer se conserva sin User.
- **Reservation**: Tiene cero o muchos Reservation (campo reservations). Cada Reservation apunta a este Customer.
- **Refund**: Tiene cero o muchos Refund (campo refunds). Cada Refund apunta a este Customer.

### Refund

Devolución de un pago aprobado al cancelar su reserva. El pago queda REFUNDED.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Refund. Si se borra el Business, se borran también sus Refund.
- **Reservation**: Pertenece siempre a un Reservation mediante reservationId; un Reservation puede tener varios Refund. Si se borra el Reservation, se borran también sus Refund.
- **Payment**: Pertenece siempre a un Payment mediante paymentId; un Payment tiene como máximo un Refund. Si se borra el Payment, se borra también su Refund.
- **Customer**: Puede pertenecer a un Customer mediante customerId; un Customer puede tener varios Refund. Si se borra el Customer, el Refund se conserva sin Customer.
- **User**: Puede pertenecer a un User mediante createdById; un User puede tener varios Refund. Si se borra el User, el Refund se conserva sin User.

### Payment

quedan pendientes hasta que el negocio los aprueba o rechaza.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Payment. Si se borra el Business, se borran también sus Payment.
- **Reservation**: Puede pertenecer a un Reservation mediante reservationId; un Reservation puede tener varios Payment. Si se borra el Reservation, el Payment se conserva sin Reservation.
- **PaymentMethod**: Pertenece siempre a un PaymentMethod mediante methodId; un PaymentMethod puede tener varios Payment. No se puede borrar un PaymentMethod mientras tenga Payment.
- **Sale**: Puede pertenecer a un Sale mediante saleId; un Sale tiene como máximo un Payment. Si se borra el Sale, el Payment se conserva sin Sale.
- **Refund**: Puede tener un Refund (campo refund); la llave foránea está en Refund.

### Product

Producto que vende el negocio por unidad (agua, bebida hidratante, alquiler de petos…).
No se borra: se desactiva, para no romper las ventas que ya lo usan.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Product. Si se borra el Business, se borran también sus Product.
- **SaleItem**: Tiene cero o muchos SaleItem (campo saleItems). Cada SaleItem apunta a este Product.
- **StockMovement**: Tiene cero o muchos StockMovement (campo stockMovements). Cada StockMovement apunta a este Product.

### Sale

Venta de productos: cargada a una reserva (consumo del turno, se paga con la reserva) o
suelta (sin reserva, se paga en el momento con su propio pago).

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Sale. Si se borra el Business, se borran también sus Sale.
- **Reservation**: Puede pertenecer a un Reservation mediante reservationId; un Reservation puede tener varios Sale. Si se borra el Reservation, el Sale se conserva sin Reservation.
- **SaleItem**: Tiene cero o muchos SaleItem (campo items). Cada SaleItem apunta a este Sale.
- **Payment**: Puede tener un Payment (campo payment); la llave foránea está en Payment.

### SaleItem

Línea de una venta. Guarda nombre y precio del producto al momento de vender.

- **Sale**: Pertenece siempre a un Sale mediante saleId; un Sale puede tener varios SaleItem. Si se borra el Sale, se borran también sus SaleItem.
- **Product**: Puede pertenecer a un Product mediante productId; un Product puede tener varios SaleItem. Si se borra el Product, el SaleItem se conserva sin Product.

### CashSession

Turno de caja: se abre con una base de efectivo y se cierra contando el efectivo real.
Solo una abierta por negocio (índice único parcial en la migración).

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios CashSession. Si se borra el Business, se borran también sus CashSession.
- **CashExpense**: Tiene cero o muchos CashExpense (campo expenses). Cada CashExpense apunta a este CashSession.
- **CashMovement**: Tiene cero o muchos CashMovement (campo movements). Cada CashMovement apunta a este CashSession.

### CashMovement

Ingreso o retiro manual de efectivo durante un turno de caja. Suma o resta
al efectivo esperado. Se anula (no se borra) mientras la caja está abierta.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios CashMovement. Si se borra el Business, se borran también sus CashMovement.
- **CashSession**: Pertenece siempre a un CashSession mediante sessionId; un CashSession puede tener varios CashMovement. Si se borra el CashSession, se borran también sus CashMovement.

### StockMovement

Historial de existencias: cada cambio de stock de un producto.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios StockMovement. Si se borra el Business, se borran también sus StockMovement.
- **Product**: Pertenece siempre a un Product mediante productId; un Product puede tener varios StockMovement. Si se borra el Product, se borran también sus StockMovement.
- **Supplier**: Puede pertenecer a un Supplier mediante supplierId; un Supplier puede tener varios StockMovement. Si se borra el Supplier, el StockMovement se conserva sin Supplier.

### Supplier

Proveedor del negocio (bebidas, hielo, aseo…). No se borra: se desactiva.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios Supplier. Si se borra el Business, se borran también sus Supplier.
- **CashExpense**: Tiene cero o muchos CashExpense (campo expenses). Cada CashExpense apunta a este Supplier.
- **StockMovement**: Tiene cero o muchos StockMovement (campo stockMovements). Cada StockMovement apunta a este Supplier.

### CashExpense

Pago a un proveedor hecho durante un turno de caja. Si es en efectivo, se
descuenta del efectivo esperado al cerrar. Se anula (no se borra) mientras la caja está abierta.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business puede tener varios CashExpense. Si se borra el Business, se borran también sus CashExpense.
- **CashSession**: Pertenece siempre a un CashSession mediante sessionId; un CashSession puede tener varios CashExpense. Si se borra el CashSession, se borran también sus CashExpense.
- **Supplier**: Puede pertenecer a un Supplier mediante supplierId; un Supplier puede tener varios CashExpense. Si se borra el Supplier, el CashExpense se conserva sin Supplier.
- **PaymentMethod**: Pertenece siempre a un PaymentMethod mediante methodId; un PaymentMethod puede tener varios CashExpense. No se puede borrar un PaymentMethod mientras tenga CashExpense.

### Amenity

Catálogo editable desde el panel: servicios que ofrece un negocio.

- **Business**: Muchos a muchos con Business: cada Amenity puede tener varios Business y cada Business puede estar en varios Amenity (campo businesses).

### CourtSurface

Catálogo editable desde el panel: superficie o tipo de grama de una cancha.

- **Court**: Tiene cero o muchos Court (campo courts). Cada Court apunta a este CourtSurface.

### PaymentMethod

Catálogo editable desde el panel: medios con los que se recibe un pago.

- **Payment**: Tiene cero o muchos Payment (campo payments). Cada Payment apunta a este PaymentMethod.
- **CashExpense**: Tiene cero o muchos CashExpense (campo cashExpenses). Cada CashExpense apunta a este PaymentMethod.

### Plan

Plan de suscripción de Mi Cancha (Gratis, Básico, Pro): precio mensual y cuántas canchas permite.

- **Subscription**: Tiene cero o muchos Subscription (campo subscriptions). Cada Subscription apunta a este Plan.

### Subscription

Plan que tiene contratado un negocio, su estado (activo o suspendido) y la fecha del próximo cobro.

- **Business**: Pertenece siempre a un Business mediante businessId; un Business tiene como máximo un Subscription. Si se borra el Business, se borra también su Subscription.
- **Plan**: Pertenece siempre a un Plan mediante planId; un Plan puede tener varios Subscription. No se puede borrar un Plan mientras tenga Subscription.

### OtpCode

Códigos de un solo uso (OTP) enviados por SMS para verificar un celular. Se
guarda solo su HMAC-SHA256, nunca el código; vencen a los 5 minutos y se
invalidan tras 5 intentos fallidos.



### AuditLog

Auditoría: quién hizo qué y cuándo. La app solo agrega filas; nunca las edita ni las borra.
Sin llave foránea al usuario a propósito: el registro debe sobrevivir si se borra la cuenta.



### PushSubscription

Navegador del usuario suscrito a notificaciones push web (Web Push / VAPID).

- **User**: Pertenece siempre a un User mediante userId; un User puede tener varios PushSubscription. Si se borra el User, se borran también sus PushSubscription.

### NotificationBroadcast

Aviso que el super admin envió a los negocios: el historial del panel.

- **NotificationImage**: Puede pertenecer a un NotificationImage mediante imageId; un NotificationImage puede tener varios NotificationBroadcast. Si se borra el NotificationImage, el NotificationBroadcast se conserva sin NotificationImage.
- **Notification**: Tiene cero o muchos Notification (campo notifications). Cada Notification apunta a este NotificationBroadcast.

### Notification

Notificación de un usuario (su bandeja): existe aunque no tenga el push activado.

- **User**: Pertenece siempre a un User mediante userId; un User puede tener varios Notification. Si se borra el User, se borran también sus Notification.
- **NotificationBroadcast**: Puede pertenecer a un NotificationBroadcast mediante broadcastId; un NotificationBroadcast puede tener varios Notification. Si se borra el NotificationBroadcast, el Notification se conserva sin NotificationBroadcast.
- **NotificationImage**: Puede pertenecer a un NotificationImage mediante imageId; un NotificationImage puede tener varios Notification. Si se borra el NotificationImage, el Notification se conserva sin NotificationImage.

### NotificationImage

Imagen que acompaña a un aviso. El archivo vive en el almacenamiento (Koofr); aquí solo su ruta.

- **NotificationBroadcast**: Tiene cero o muchos NotificationBroadcast (campo broadcasts). Cada NotificationBroadcast apunta a este NotificationImage.
- **Notification**: Tiene cero o muchos Notification (campo notifications). Cada Notification apunta a este NotificationImage.

## Enums

| Enum | Valores |
|---|---|
| `UserRole` | `SUPER_ADMIN`, `ADMIN_NEGOCIO`, `JUGADOR` |
| `Sport` | `FUTBOL`, `PADEL`, `BALONCESTO`, `VOLEIBOL` |
| `DayOfWeek` | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| `CourtPhotoSlot` | `MAIN`, `SURFACE`, `LIGHTING`, `EXTRA_1`, `EXTRA_2` |
| `ReservationSource` | `BUSINESS`, `WEB` |
| `ReservationStatus` | `CONFIRMED`, `COMPLETED`, `NO_SHOW`, `CANCELLED` |
| `PaymentConcept` | `ANTICIPO`, `SALDO`, `TOTAL`, `VENTA` |
| `ProductCategory` | `AGUA`, `BEBIDA`, `HIDRATANTE`, `CERVEZA`, `SNACK`, `COMIDA`, `ALQUILER`, `OTRO` |
| `SaleStatus` | `ACTIVE`, `VOIDED` |
| `PaymentStatus` | `PENDING`, `APPROVED`, `REJECTED`, `REFUNDED` |
| `CashMovementType` | `INGRESO`, `RETIRO` |
| `StockMovementType` | `ENTRADA`, `AJUSTE`, `VENTA`, `ANULACION` |
| `AuditCategory` | `ADMIN`, `SECURITY` |
| `NotificationType` | `NEW_RESERVATION`, `ADMIN_BROADCAST` |

## Únicos compuestos

- User: (role, phone)
- Court: (businessId, name)
- SlotHold: (businessId, playerId, courtId)
- CourtSchedule: (courtId, dayOfWeek)
- CourtPhoto: (courtId, slot)
- Customer: (businessId, phone)
- Customer: (businessId, documentId)
- Customer: (businessId, userId)
- Product: (businessId, name)
- Supplier: (businessId, name)
