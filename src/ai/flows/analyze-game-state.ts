
'use server';

/**
 * @fileOverview Game state analyzer AI agent for Savannah Chase.
 *
 * - analyzeGameState - A function that analyzes the game state and provides a summary.
 * - AnalyzeGameStateInput - The input type for the analyzeGameState function.
 * - AnalyzeGameStateOutput - The return type for the analyzeGameState function.
 */

import {ai} from '@/ai/genkit';
import {z}from 'genkit';

const AnalyzeGameStateInputSchema = z.object({
  boardState: z
    .string()
    .describe('Der aktuelle Zustand des 8x7 Spielbretts (8 Reihen, 7 Spalten) als Zeichenkette. Reihen 0-indiziert (oben, KI Schwarz), Spalten 0-indiziert (links). Zellen durch Leerzeichen, Reihen durch Zeilenumbrüche. Format: SpielerinitialTierinitial (z.B. WZ für Spieler (Weiß) Gazelle, BL für KI (Schwarz) Löwe, BG für KI (Schwarz) Giraffe). Leer: "..". Terrain: K=Kluft (verschiebt Figur in eine spieldefinierte zufällige Richtung, wenn darauf gelandet), S=Sumpf (Löwen/Gazellen pausieren nächste Runde, Giraffen können nicht betreten), H=Hügel (NUR Giraffen können betreten).'),
  playerOneName: z.string().describe('Der Name von Spieler Eins (KI, Schwarz, Oben).'),
  playerTwoName: z.string().describe('Der Name von Spieler Zwei (Spieler, Weiß, Unten).'),
});
export type AnalyzeGameStateInput = z.infer<typeof AnalyzeGameStateInputSchema>;

const AnalyzeGameStateOutputSchema = z.object({
  playerOneSummary: z // AI Player (Schwarz, Oben)
    .string()
    .describe('Eine kurze Zusammenfassung der Vor-/Nachteile für Spieler Eins (KI, Schwarz, Oben). Fokus auf Brettkontrolle, Figurensicherheit, Bedrohungen, Fortschritt zu den Siegbedingungen. Identifiziere blockierte Figuren oder Figuren mit sehr wenigen Zugoptionen und schlage Möglichkeiten zur Verbesserung der Position vor. Achte auf die Auswirkungen von Sumpf (Pause für L/Z), Kluft (Verschiebung, Richtung beachten!) und Hügel (nur G).'),
  playerTwoSummary: z // Human Player (Weiß, Unten)
    .string()
    .describe('Eine kurze Zusammenfassung der Vor-/Nachteile für Spieler Zwei (Spieler, Weiß, Unten). Fokus auf Brettkontrolle, Figurensicherheit, Bedrohungen, Fortschritt zu den Siegbedingungen. Identifiziere blockierte Figuren oder Figuren mit sehr wenigen Zugoptionen und schlage Möglichkeiten zur Verbesserung der Position vor. Achte auf die Auswirkungen von Sumpf (Pause für L/Z), Kluft (Verschiebung, Richtung beachten!) und Hügel (nur G).'),
  overallAssessment: z
    .string()
    .describe("Eine kurze Gesamtbewertung des Spielzustands, z.B. 'KI (Schwarz) hat einen leichten Vorteil durch bessere Löwenpositionierung.' oder 'Spieler (Weiß) ist in einer schwierigen Position, da viele Figuren blockiert sind.' Berücksichtige detaillierter, wer möglicherweise von den aktuellen Spezialfeldern profitiert oder dadurch behindert wird und warum."),
});
export type AnalyzeGameStateOutput = z.infer<typeof AnalyzeGameStateOutputSchema>;

export async function analyzeGameState(
  input: AnalyzeGameStateInput
): Promise<AnalyzeGameStateOutput> {
  return analyzeGameStateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeGameStatePrompt_v0_4_8x7_randomTerrains_DE_refined',
  input: {schema: AnalyzeGameStateInputSchema},
  output: {schema: AnalyzeGameStateOutputSchema},
  prompt: `Du bist ein Experte für Spielanalysen für "Savannah Chase" (Version 0.4 GDD, mit zufälligen Klüften und Sumpf-/Hügel-Regeln auf einem 8x7 Brett).
Das Brett ist 8x7 groß (8 Reihen, 7 Spalten). Spieler Eins ({{{playerOneName}}}, KI, Schwarz, Oben) startet in den Reihen 0/1. Spieler Zwei ({{{playerTwoName}}}, Spieler, Weiß, Unten) startet in den Reihen 7/6 (Reihe 7 ist die letzte Reihe für den Spieler).

Figuren:
- Löwe (L): Zieht 1-2 Felder (jede Richtung). Pausiert 1 Zug nach Bewegung. Nur von Löwe/Giraffe schlagbar. Wenn er auf Sumpf (S) landet, pausiert er nächste Runde. Kann Hügel (H) nicht betreten.
- Giraffe (G): Zieht max. 2 Felder (H/V). Kann Sumpf (S) nicht betreten und auch nicht darüber springen, wenn es das Zwischenfeld eines 2-Felder-Zugs ist. KANN Hügel (H) betreten. Kann eine Kluft (K) bei einem 2-Felder-Zug nicht überspringen, wenn das Zwischenfeld eine Kluft ist.
- Gazelle (Z): Spieler (Weiß, Unten) Gazellen ziehen 1 Feld "vorwärts" (Reihenindex sinkt). KI (Schwarz, Oben) Gazellen ziehen 1 Feld "vorwärts" (Reihenindex steigt). Schlägt 1 Feld diag. vorwärts (nur gegn. Gazellen). Kann Löwen und Giraffen nicht schlagen. Wenn sie auf Sumpf (S) landet, pausiert sie nächste Runde. Kann Hügel (H) nicht betreten.

Terrain:
'K' (Kluft): Landet eine Figur hier, wird sie in eine spezifische, zufällig bestimmte Richtung (N, S, E oder W) geschoben, bis sie auf ein Hindernis trifft. Schlägt nicht.
'S' (Sumpf): Landen Löwe oder Gazelle hier, müssen sie nächste Runde pausieren. Giraffen können Sumpf nicht betreten.
'H' (Hügel): NUR Giraffen können dieses Terrain betreten. Löwen und Gazellen nicht.

Sieg: Gegnerischen Löwen ODER alle 5 gegn. Gazellen schlagen.

Spielbrett (0-indizierte Reihen von KI Schwarz oben, 0-indizierte Spalten von links):
{{{boardState}}}

Spieler Eins: {{{playerOneName}}} (KI, Schwarz, Oben)
Spieler Zwei: {{{playerTwoName}}} (Spieler, Weiß, Unten)

Analysiere den Spielzustand. Liefere:
1. Für Spieler Eins ({{{playerOneName}}}): Eine Zusammenfassung der Vor-/Nachteile, Figurensicherheit, Bedrohungen, Fortschritt zum Sieg. Achte besonders auf blockierte Figuren oder Figuren mit sehr wenigen Zugoptionen. Wie kann die Position verbessert oder Figuren befreit werden? Wie können Spezialfelder genutzt/vermieden werden?
2. Für Spieler Zwei ({{{playerTwoName}}}): Eine Zusammenfassung (wie oben). Achte besonders auf blockierte Figuren oder Figuren mit sehr wenigen Zugoptionen. Wie kann die Position verbessert oder Figuren befreit werden? Wie können Spezialfelder genutzt/vermieden werden?
3. Eine kurze Gesamtbewertung: Wer könnte in einer besseren Position sein und warum? Berücksichtige Materialvorteil, Positionsstärke (Kontrolle über wichtige Felder, Figurenentwicklung, Figurenmobilität), Sicherheit des "Königs" (Löwe) und direkte Bedrohungen. Beurteile, wer von den aktuellen Spezialfeldern (Kluft, Sumpf, Hügel) profitiert oder dadurch behindert wird, und wie.

Sei prägnant und strategisch. Antworte auf Deutsch. Vermeide unnötige Wiederholungen in den Zusammenfassungen.
Denke daran, dass Spieler Eins (KI, Schwarz) oben spielt und Spieler Zwei (Spieler, Weiß) unten.
Konzentriere dich auf die Verbesserung der Beweglichkeit und die Vermeidung von Selbstblockaden.
`,
});

const analyzeGameStateFlow = ai.defineFlow(
  {
    name: 'analyzeGameStateFlow_v0_4_8x7_randomTerrains_DE_refined',
    inputSchema: AnalyzeGameStateInputSchema,
    outputSchema: AnalyzeGameStateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.playerOneSummary || !output.playerTwoSummary || !output.overallAssessment) {
        console.error('KI-Analyse konnte keine vollständige Ausgabe erzeugen. Eingabe:', input, 'Rohe Ausgabe:', output);
        // Fallback, falls die KI nicht die erwartete Struktur liefert
        return {
            playerOneSummary: "Analysedaten unvollständig. Die KI konnte die Spielsituation für Spieler Eins nicht vollständig bewerten. Bitte überprüfe die Konsole für Details.",
            playerTwoSummary: "Analysedaten unvollständig. Die KI konnte die Spielsituation für Spieler Zwei nicht vollständig bewerten. Bitte überprüfe die Konsole für Details.",
            overallAssessment: "Spielbewertung konnte aufgrund unvollständiger KI-Ausgabe nicht ermittelt werden."
        };
    }
    return output;
  }
);

