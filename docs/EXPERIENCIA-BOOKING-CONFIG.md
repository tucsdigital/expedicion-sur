# Estructura de datos: bookingConfig (Reserva / Calendario)

Todo el bloque "Reserva / Calendario" de una experiencia se guarda dentro del documento de la experiencia en Firestore en el campo **`bookingConfig`**.

## Tipos TypeScript

```ts
type BookingDate = {
  date: string;        // "2025-02-15" (YYYY-MM-DD)
  capacity: number;    // cupos de esa fecha
  enabled: boolean;    // fecha activa/inactiva
};

type BookingConfig = {
  enabled: boolean;                 // activa la sección reserva en el front
  title: string;                    // "Río se disfruta más..."
  subtitle1: string;                // "Elegí tu fecha ideal..."
  subtitle2: string;                // "Pago seguro..."
  hasSpecificDates: boolean;        // si false => "Sin fechas específicas"
  dates: BookingDate[];             // listado de fechas (si hasSpecificDates = true)
  depositAmount: number;            // precio de seña/reserva (ej 120000)
  maxPeoplePerBooking: number;      // ej 10 (reemplaza "Máximo 10")
  paymentMethods: {
    stripe: boolean;
    pix: boolean;
  };
};
```

- **depositAmount**: se guarda como número (moneda según el sistema).
- **maxPeoplePerBooking**: se usa en el front para el stepper de personas.
- **hasSpecificDates = false**: permite reservar sin elegir fecha; se coordina después. El front permite continuar sin fecha.

## Datos públicos para el front (BookingPublicData)

La función `toBookingPublicData(experience)` en `lib/experiencias.ts` devuelve:

- Los mismos campos que `BookingConfig`, con `dates` enriquecidos: cada fecha incluye **available** (por ahora `available = capacity`; luego se descontarán reservas confirmadas).

## Validación (Zod)

El schema `bookingConfigSchema` en `lib/schemas/booking.ts` valida:

- Al menos un método de pago (stripe o pix).
- No fechas duplicadas.
- Capacity mínimo 1 si la fecha está habilitada.
