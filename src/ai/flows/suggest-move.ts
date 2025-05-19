
'use server';

/**
 * @fileOverview An AI agent to suggest a move for the player in Savannah Chase.
 *
 * - suggestMove - A function that suggests a move for the player.
 * - SuggestMoveInput - The input type for the suggestMove function.
 * - SuggestMoveOutput - The return type for the suggestMove function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

// Schema für die Eingabe der Zugvorschlags-Funktion
const SuggestMoveInputSchema = z.object({
  boardState: z
    .string()
    .describe('Der aktuelle Zustand des 8x7 Spielbretts (8 Reihen, 7 Spalten) als Zeichenkette. Reihen 0-indiziert (oben, KI Schwarz), Spalten 0-indiziert (links). Zellen durch Leerzeichen, Reihen durch Zeilenumbrüche. Format: SpielerinitialTierinitial (z.B. WZ für Spieler (Weiß) Gazelle, BL für KI (Schwarz) Löwe, BG für KI (Schwarz) Giraffe). Leer: "..". Terrain: K=Kluft (verschiebt Figur in eine spieldefinierte zufällige Richtung, wenn darauf gelandet), S=Sumpf (Löwen/Gazellen pausieren nächste Runde, Giraffen können nicht betreten), H=Hügel (NUR Giraffen können betreten).'),
  playerTurn: z
    .string()
    .describe('Der Name des Spielers, der am Zug ist (z.B. Spieler (Weiß, Unten), KI-Gegner (Schwarz, Oben)). Gib an, ob der Löwe oder eine andere Figur pausiert (z.B. durch Sumpf oder eigenen Löwenzug).'),
});
export type SuggestMoveInput = z.infer<typeof SuggestMoveInputSchema>;

// Schema für die Ausgabe der Zugvorschlags-Funktion
const SuggestMoveOutputSchema = z.object({
  suggestedMove: z.string().describe("Eine textuelle Beschreibung des vorgeschlagenen Zuges, z.B. 'Bewege Gazelle von B6 nach B5' oder 'Bewege Löwe von D1 nach D4 um Gazelle zu schlagen'. Wenn eine Figur pausiert, dies angeben. Wenn keine guten Züge möglich sind oder alle Figuren blockiert sind, dies ebenfalls erklären und ggf. einen Defensivzug oder einen Zug zur Befreiung einer Figur vorschlagen."),
});
export type SuggestMoveOutput = z.infer<typeof SuggestMoveOutputSchema>;

// Exportierte Funktion, die den Flow aufruft
export async function suggestMove(input: SuggestMoveInput): Promise<SuggestMoveOutput> {
  return suggestMoveFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMovePrompt_v0_4_8x7_randomTerrains_DE_refined', // Name des Prompts (Version aktualisiert)
  input: {schema: SuggestMoveInputSchema},
  output: {schema: SuggestMoveOutputSchema},
  prompt: `Du bist eine strategische Spiel-KI für "Savannah Chase" (Version 0.4 GDD mit zufälligen Klüften und Sumpf-/Hügel-Regeln auf einem 8x7 Brett).
Das Brett ist ein 8x7 Gitter (8 Reihen, 7 Spalten). Spieler Eins (KI, Schwarz, Oben) Figuren starten auf Reihe 0/1 und Spieler Zwei (Spieler, Weiß, Unten) Figuren starten auf Reihe 7/6 (Reihe 7 ist die unterste Reihe für den Spieler).

Figuren:
- Löwe (L): Zieht 1 Feld (orthogonal/diagonal). Kann nicht springen. Muss 1 Zug nach Bewegung pausieren. Nur von gegn. Löwe oder Giraffe schlagbar. Wenn er auf Sumpf (S) landet, muss er nächste Runde pausieren. Kann Hügel (H) nicht betreten.
- Giraffe (G): Zieht max. 2 Felder (orthogonal). Kann nicht springen. Kann Sumpf (S) nicht betreten und auch nicht darüber springen, wenn es das Zwischenfeld eines 2-Felder-Zugs ist. KANN Hügel (H) betreten. Kann eine Kluft (K) bei einem 2-Felder-Zug nicht überspringen, wenn das Zwischenfeld eine Kluft ist.
- Gazelle (Z): Spieler (Weiß, Unten) Gazellen ziehen 1 Feld "vorwärts" (Reihenindex sinkt). KI (Schwarz, Oben) Gazellen ziehen 1 Feld "vorwärts" (Reihenindex steigt). Schlägt 1 Feld diagonal vorwärts (nur gegn. Gazellen). Kann Löwen und Giraffen nicht schlagen. Wenn sie auf Sumpf (S) landet, muss sie nächste Runde pausieren. Kann Hügel (H) nicht betreten.

Figurennotation: SpielerinitialTiercharakter (z.B. WZ, BL, BG). '..' bezeichnet ein leeres Feld.
Terrain:
'K' (Kluft): Landet eine Figur hier, wird sie in eine spezifische, zufällig bestimmte Richtung (N, S, E oder W) geschoben, bis sie auf ein Hindernis trifft. Schlägt nicht.
'S' (Sumpf): Landen Löwe oder Gazelle hier, müssen sie nächste Runde pausieren. Giraffen können Sumpf nicht betreten.
'H' (Hügel): NUR Giraffen können dieses Terrain betreten. Löwen und Gazellen nicht.

Siegbedingungen:
1. Gegnerischen Löwen schlagen.
2. Alle 5 gegnerischen Gazellen schlagen.

Aktueller Spielzustand (0-indizierte Reihen von KI Schwarz oben, 0-indizierte Spalten von links, Zellen in einer Reihe durch Leerzeichen getrennt):
{{{boardState}}}

Es ist {{{playerTurn}}} am Zug.
Berücksichtige, ob Figuren von {{{playerTurn}}} pausieren (Löwe wegen eigenem Zug, oder Löwe/Gazelle wegen Landung auf Sumpf). Eine pausierende Figur kann nicht ziehen.

Analysiere das Brett und schlage den bestmöglichen Zug für {{{playerTurn}}} vor.
Der vorgeschlagene Zug sollte in einem klaren, handlungsorientierten Format beschrieben werden, mit Angabe der Figur, ihrer Start- und Endkoordinaten (Format: SpaltenbuchstabeReihennummer, z.B. A1, G8 - Reihen von 1-8, Spalten A-G). Beispiel: "Bewege Gazelle von B6 nach B5" oder "Bewege Löwe von D1 nach D4 um Giraffe zu schlagen".
Wenn eine Schlüsselfigur pausiert, erwähne dies, z.B. "Löwe bei C3 ist pausiert. Schlage vor, Gazelle von B6 nach B5 zu bewegen."
Wenn für {{{playerTurn}}} keine sinnvollen Züge möglich sind (z.B. alle Figuren blockiert oder nur Züge, die in direkten Nachteil führen), gib das klar an und erkläre kurz warum, z.B. "Keine guten Züge verfügbar, da alle Figuren blockiert sind. Versuche, Gazelle von E2 nach E3 zu bewegen, um eine Figur zu befreien."

Priorisiere Züge in dieser Reihenfolge:
1. Ein Zug, der das Spiel gewinnt (gegnerischen Löwen oder letzte gegnerische Gazelle schlägt).
2. Ein Zug, der eine hochwertige Figur (Löwe > Giraffe > Gazelle) sicher schlägt. Vermeide Züge, bei denen die eigene Figur sofort zurückgeschlagen werden kann, es sei denn, es ist ein strategischer Tausch.
3. Ein Zug, der einen sofortigen Gewinnzug des Gegners blockiert.
4. Ein Zug, der eine starke offensive oder defensive Position aufbaut, unter Berücksichtigung des Terrains und der Vermeidung von Selbstblockaden. Landung auf einer Kluft (K) kann riskant (unerwünschte Verschiebung) oder vorteilhaft sein – wäge ab. Vermeide es, Löwen/Gazellen auf Sumpf (S) zu bewegen, wenn andere gute Züge existieren (Pause!). Giraffen können Hügel (H) strategisch nutzen.
5. Ein Zug, der eine Figur entwickelt, die Bewegungsfreiheit erhöht oder eine weniger wertvolle Figur schlägt, ohne sich selbst in große Gefahr zu begeben oder zu blockieren. Vermeide Züge, die deine eigenen Figuren unnötig blockieren oder deine Bewegungsfreiheit stark einschränken, es sei denn, es ist ein klarer strategischer Vorteil.
6. Jeder andere gültige Zug. Vermeide es, in offensichtliche Gefahr zu ziehen oder Figuren ohne Notwendigkeit zu blockieren.
Wenn eine Figur pausiert, schlage nicht vor, sie zu bewegen.

Antworte auf Deutsch und liefere nur den vorgeschlagenen Zugtext.
Stelle sicher, dass die Koordinaten im Format SpaltenbuchstabeReihennummer (z.B. A1, D8, G6) sind.
Spieler (Weiß, Unten) bewegt sich von hohen Reihennummern zu niedrigen. KI (Schwarz, Oben) von niedrigen zu hohen.
Denke strategisch über die Auswirkungen der Spezialfelder nach. Vermeide es, Züge vorzuschlagen, die Figuren unnötig blockieren oder die eigene Bewegungsfreiheit stark einschränken.
`,
});

// Definition des Flows
const suggestMoveFlow = ai.defineFlow(
  {
    name: 'suggestMoveFlow_v0_4_8x7_randomTerrains_DE_refined', // Name des Flows (Version aktualisiert)
    inputSchema: SuggestMoveInputSchema,
    outputSchema: SuggestMoveOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    // Fallback, falls die KI keine gültige Ausgabe produziert
    if (!output || typeof output.suggestedMove !== 'string') {
      console.error('KI konnte keine gültige suggestedMove-Ausgabe produzieren. Eingabe:', input, 'Rohe Ausgabe:', output);
      return { suggestedMove: `KI konnte keinen Zug für ${input.playerTurn} ermitteln. Bitte versuche es erneut oder mache einen manuellen Zug.` };
    }
    return output;
  }
);

    