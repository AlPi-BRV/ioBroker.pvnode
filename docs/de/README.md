# ioBroker.pvnode – Anleitung

PV-Ertragsprognose von [pvnode.com](https://pvnode.com) für ioBroker.

## Einrichtung

1. Auf [pvnode.com](https://pvnode.com/sites/new) einen Standort mit deinen Strings (Dachflächen) anlegen und den API-Key kopieren.
2. Adapter installieren und den API-Key eintragen.
3. Standort auswählen. Gibt es nur einen, kann das Feld leer bleiben.

## Was der Adapter macht

- Er fragt pvnode nur ab, wenn dort eine neue Prognose berechnet wurde. Im kostenlosen Plan ist das etwa einmal am Tag.
- Die letzte Prognose wird gespeichert. Nach einem Neustart wird nicht sofort neu abgefragt.
- Aktuelle Leistung, Restertrag heute und Spitzenleistung werden alle 5 Minuten lokal aus der Prognosekurve berechnet. Das kostet keine Anfragen.
- Der Plan (Kostenlos, Light, Plus) wird automatisch erkannt.

## Die wichtigsten Datenpunkte

| Datenpunkt | Bedeutung |
| --- | --- |
| `now.power` | Prognostizierte Leistung im aktuellen 15-Minuten-Intervall (W) |
| `today.energy` | Prognose für heute (kWh) |
| `today.remaining` | Noch erwarteter Ertrag ab jetzt (kWh) |
| `today.expected_so_far` | Bis jetzt erwarteter Ertrag (kWh), zum Vergleich mit der echten Erzeugung |
| `tomorrow.energy` | Prognose für morgen (kWh) |
| `days.N.energy` | Prognose für Tag N (0 = heute) |
| `strings.N.*` | Werte pro String |
| `json.today` | Tageskurve für Diagramme |
| `info.requestsRemaining` | Restliche Anfragen in diesem Monat |
| `control.refresh` | Sofort neu abfragen (kostet eine Anfrage) |

## Unterstützung

Wenn dir der Adapter hilft: [☕ Spendier mir einen Kaffee](https://buymeacoffee.com/alpi_brv)
