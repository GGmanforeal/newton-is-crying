export interface Example {
  id: string;
  title: string;
  text: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'road-trip',
    title: '🚗 Road trip (with mistakes)',
    text: `# Problem 3 — a car trip from Tashkent to Samarkand
d = 300 km
t = 4 h
v = d / t -> m/s

# acceleration from rest over the first 2 minutes
a = v / (2 min) [m/s^2]

# kinetic energy of a 1200 kg car
m = 1200 kg
KE = 0.5 * m * v^2 [J]

# how far did we go in total? (oops)
total = d + t   # total trip

# momentum — but something is off
p = m * a [kg*m/s]

# angle of the road
sin(30)`,
  },
  {
    id: 'formulas',
    title: '📐 Check formulas (no numbers)',
    text: `# Declare what each symbol measures, then check formulas.
v : m/s
u : m/s
a : m/s^2
t : s
s : m

v = u + a*t
s = u*t + 0.5*a*t^2
v^2 = u^2 + 2*a*s

# a classic exam mistake:
s = u*t + a*t`,
  },
  {
    id: 'kettle',
    title: '☕ How long to boil a kettle?',
    text: `# Heat 1.5 L of water from 20 °C to 100 °C with a 2 kW kettle
m = 1.5 kg
c_w = 4186 J/kg/K
dT = 80 K
Q = m * c_w * dT
P = 2 kW
time = Q / P -> min

# and the electricity bill
E = P * time -> kWh`,
  },
  {
    id: 'circuits',
    title: '⚡ Circuits',
    text: `I = 0.5 A
R = 220 ohm
V = I * R
P = V * I -> mW

# power can't be volts per amp…
P2 = V / I [W]

# charge through the circuit in one hour
Q = I * 1 h -> C`,
  },
  {
    id: 'space',
    title: '🪐 Orbital physics',
    text: `M = 5.972e24 kg   # Earth
r = 6371 km + 400 km   # ISS altitude
v = sqrt(G * M / r) -> km/h
T = 2 pi r / v -> min

# escape velocity, written wrong:
v_esc = sqrt(2 * G * M) -> km/s`,
  },
];
