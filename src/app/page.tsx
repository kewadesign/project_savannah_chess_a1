
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import GameBoard from '@/components/game/GameBoard';
import type { GameState, Piece, Board, PlayerType, AnimalType, Square, TerrainType, CapturedPieces, RiftDirection } from '@/types/game';
import { BOARD_ROWS, BOARD_COLS, NUM_RANDOM_SWAMPS, NUM_RANDOM_HILLS, NUM_RANDOM_RIFTS, TERRAIN_RESTRICTED_ROWS } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Cpu, User, Lightbulb, Award, HelpCircle, Info, Wind, Waves, Mountain, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { analyzeGameState } from '@/ai/flows/analyze-game-state';
import { suggestMove } from '@/ai/flows/suggest-move';
import { useToast } from "@/hooks/use-toast";
import Tutorial from '@/components/game/Tutorial';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";


const initialPiecesSetup: Record<string, Omit<Piece, 'id'>> = {
  // AI Pieces (Schwarz, Oben) - Player 'ai'
  'ai_giraffe_c1': { animal: 'giraffe', player: 'ai', position: { row: 0, col: 2 } },
  'ai_lion_d1':    { animal: 'lion',    player: 'ai', position: { row: 0, col: 3 } },
  'ai_giraffe_e1': { animal: 'giraffe', player: 'ai', position: { row: 0, col: 4 } },
  'ai_gazelle_b2': { animal: 'gazelle', player: 'ai', position: { row: 1, col: 1 } },
  'ai_gazelle_c2': { animal: 'gazelle', player: 'ai', position: { row: 1, col: 2 } },
  'ai_gazelle_d2': { animal: 'gazelle', player: 'ai', position: { row: 1, col: 3 } },
  'ai_gazelle_e2': { animal: 'gazelle', player: 'ai', position: { row: 1, col: 4 } },
  'ai_gazelle_f2': { animal: 'gazelle', player: 'ai', position: { row: 1, col: 5 } },

  // Human Pieces (Weiß, Unten) - Player 'human'
  // Rows are 0-indexed from top. For 8 rows, player's back rank is row 7, gazelles on row 6.
  'h_giraffe_c_last': { animal: 'giraffe', player: 'human', position: { row: BOARD_ROWS - 1, col: 2 } },
  'h_lion_d_last':    { animal: 'lion',    player: 'human', position: { row: BOARD_ROWS - 1, col: 3 } },
  'h_giraffe_e_last': { animal: 'giraffe', player: 'human', position: { row: BOARD_ROWS - 1, col: 4 } },
  'h_gazelle_b_penultimate': { animal: 'gazelle', player: 'human', position: { row: BOARD_ROWS - 2, col: 1 } },
  'h_gazelle_c_penultimate': { animal: 'gazelle', player: 'human', position: { row: BOARD_ROWS - 2, col: 2 } },
  'h_gazelle_d_penultimate': { animal: 'gazelle', player: 'human', position: { row: BOARD_ROWS - 2, col: 3 } },
  'h_gazelle_e_penultimate': { animal: 'gazelle', player: 'human', position: { row: BOARD_ROWS - 2, col: 4 } },
  'h_gazelle_f_penultimate': { animal: 'gazelle', player: 'human', position: { row: BOARD_ROWS - 2, col: 5 } },
};


function createInitialPieces(): Record<string, Piece> {
  const pieces: Record<string, Piece> = {};
  for (const key in initialPiecesSetup) {
    pieces[key] = { ...initialPiecesSetup[key], id: key } as Piece;
  }
  return pieces;
}

function createInitialBoard(pieces: Record<string, Piece>): Board {
  const board: Board = Array(BOARD_ROWS).fill(null).map((_, r) =>
    Array(BOARD_COLS).fill(null).map((_, c) => ({
      row: r,
      col: c,
      terrain: 'none' as TerrainType,
      pieceId: null,
    }))
  );

  const occupiedByFixedTerrainOrPiece = new Set<string>();
  Object.values(pieces).forEach(p => {
    occupiedByFixedTerrainOrPiece.add(`${p.position.row}-${p.position.col}`);
  });

  const availableCellsForRandomTerrain: {row: number, col: number}[] = [];
  for (let r = 0; r < BOARD_ROWS; r++) {
    if (TERRAIN_RESTRICTED_ROWS.includes(r)) continue;
    for (let c = 0; c < BOARD_COLS; c++) {
       if (!occupiedByFixedTerrainOrPiece.has(`${r}-${c}`)) {
        availableCellsForRandomTerrain.push({row: r, col: c});
      }
    }
  }

  for (let i = availableCellsForRandomTerrain.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableCellsForRandomTerrain[i], availableCellsForRandomTerrain[j]] = [availableCellsForRandomTerrain[j], availableCellsForRandomTerrain[i]];
  }

  let randomTerrainPlacedCount = 0;
  const placeTerrain = (terrainType: TerrainType, count: number) => {
    for (let i = 0; i < count && randomTerrainPlacedCount < availableCellsForRandomTerrain.length; i++) {
      const cell = availableCellsForRandomTerrain[randomTerrainPlacedCount++];
      board[cell.row][cell.col].terrain = terrainType;
      if (terrainType === 'rift') {
        const riftDirections: RiftDirection[] = [
          { dRow: -1, dCol: 0 }, // North
          { dRow: 1, dCol: 0 },  // South
          { dRow: 0, dCol: -1 }, // West
          { dRow: 0, dCol: 1 },  // East
        ];
        board[cell.row][cell.col].riftDirection = riftDirections[Math.floor(Math.random() * riftDirections.length)];
      }
      occupiedByFixedTerrainOrPiece.add(`${cell.row}-${cell.col}`);
    }
  };

  placeTerrain('swamp', NUM_RANDOM_SWAMPS);
  placeTerrain('hill', NUM_RANDOM_HILLS);
  placeTerrain('rift', NUM_RANDOM_RIFTS);

  Object.values(pieces).forEach(p => {
    board[p.position.row][p.position.col].pieceId = p.id;
  });
  return board;
}

export function getAnimalChar(animal: AnimalType): string {
  switch(animal) {
    case 'gazelle': return 'Z';
    case 'giraffe': return 'G';
    case 'lion': return 'L';
    default: return '?';
  }
}

function getTerrainCharForBoardString(terrain: TerrainType): string {
  switch (terrain) {
    case 'rift': return 'K';
    case 'swamp': return 'S';
    case 'hill': return 'H';
    default: return '';
  }
}

function getBoardString(board: Board, pieces: Record<string, Piece>): string {
  return board.map(row =>
    row.map(square => {
      if (square.pieceId) {
        const piece = pieces[square.pieceId];
        const playerChar = piece.player === 'ai' ? 'B' : 'W'; // AI ist Schwarz (B), Spieler ist Weiß (W)
        const animalChar = getAnimalChar(piece.animal);
        return `${playerChar}${animalChar}`;
      }
      const terrainChar = getTerrainCharForBoardString(square.terrain);
      return terrainChar !== '' ? terrainChar : '..';
    }).join(' ')
  ).join('\n');
}

function initializeGameState(): GameState {
  const pieces = createInitialPieces();
  const initialCapturedScore: CapturedPieces = { gazelle: 0, lion: 0, giraffe: 0 };
  return {
    board: createInitialBoard(pieces),
    pieces: pieces,
    currentPlayer: 'human', // Spieler (Weiß, Unten) beginnt
    selectedPieceId: null,
    validMoves: [],
    winner: null,
    playerOneName: 'KI-Gegner (Schwarz)', // AI Player (Schwarz, Oben)
    playerTwoName: 'Spieler (Weiß)',   // Human Player (Weiß, Unten)
    humanCapturedAIScore: { ...initialCapturedScore }, // Durch Spieler (Weiß) geschlagene KI (Schwarz) Figuren
    aiCapturedHumanScore: { ...initialCapturedScore },   // Durch KI (Schwarz) geschlagene Spieler (Weiß) Figuren
    lionMovedLastTurn: null,
    swampSkipTurnForPiece: null,
    isGameOver: false,
    message: "Spieler (Weiß) ist am Zug. Wähle eine Figur.",
  };
}

const GameRulesContent: React.FC = () => {
  return (
    <ScrollArea className="h-[60vh] pr-6">
      <DialogDescription as="div" className="text-sm text-foreground space-y-3">
        <h3 className="font-semibold text-lg text-primary">Savannah Chase - Spielregeln (GDD v0.4 - 8x7 Brett)</h3>

        <section>
          <h4 className="font-semibold text-md mt-2">1. Spielkonzept & Zielgruppe</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Konzept:</strong> Eine kindgerechte Neuinterpretation des Schachspiels auf einem 8x7 Brett mit Tiermotiven. Fokus auf vereinfachte Regeln, Zugänglichkeit und ein "playful" Spielgefühl. Enthält Spezialfelder.</li>
            <li><strong>Zielgruppe:</strong> Kinder (ca. 6-14 Jahre), Familien, Gelegenheitsspieler.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">2. Spielziel / Siegbedingungen</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Das Spiel endet und ein Spieler gewinnt, wenn:
              <ul className="list-circle list-inside ml-4">
                <li>Der gegnerische Löwe geschlagen wird.</li>
                <li>Alle 5 gegnerischen Gazellen geschlagen wurden.</li>
              </ul>
            </li>
            <li>Es gibt kein Schachmatt. Ein Löwe ohne gültige Züge kann direkt geschlagen werden (sofern die angreifende Figur dazu berechtigt ist).</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">3. Spielaufbau</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Spielbrett:</strong> 8 Reihen x 7 Spalten.</li>
            <li><strong>Figuren pro Spieler:</strong> 1 Löwe (L), 2 Giraffen (G), 5 Gazellen (Z).</li>
            <li><strong>Startaufstellung (Symmetrisch, 0-indizierte Reihen):</strong>
              <ul className="list-circle list-inside ml-4">
                 <li><strong>KI (Schwarz, Oben - Reihen 0/1):</strong> G(0,C), L(0,D), G(0,E) | Z(1,B), Z(1,C), Z(1,D), Z(1,E), Z(1,F) <span className="text-xs">(z.B. L bei D1)</span></li>
                 <li><strong>Spieler (Weiß, Unten - Reihen 7/6):</strong> G(7,C), L(7,D), G(7,E) | Z(6,B), Z(6,C), Z(6,D), Z(6,E), Z(6,F) <span className="text-xs">(z.B. L bei D8)</span></li>
              </ul>
            </li>
            <li><strong>Spezialfelder:</strong>
              <ul className="list-circle list-inside ml-4">
                <li>Sümpfe (S), Hügel (H), Klüfte (K) werden zufällig platziert. Sie erscheinen nicht auf den ersten beiden Reihen jedes Spielers (Reihen 0,1,6,7 bei 8 Reihen).</li>
                <li><strong>Kluft (K):</strong> Landet eine Figur hier, wird sie in eine zufällig bestimmte Richtung (Norden, Süden, Osten oder Westen) geschoben, bis sie auf ein Hindernis trifft. Schlägt dabei keine Figuren.</li>
                <li><strong>Sumpf (S):</strong> Landen Löwe oder Gazelle hier, müssen sie in ihrer nächsten Runde pausieren. Giraffen können Sumpf nicht betreten und auch nicht darüber springen.</li>
                <li><strong>Hügel (H):</strong> NUR Giraffen können dieses Terrain betreten. Löwen und Gazellen nicht.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">4. Spielablauf</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Rundenbasiert, Spieler ziehen abwechselnd. Spieler (Weiß) beginnt.</li>
            <li>Der Spieler (Weiß) bewegt Figuren per Klick (Figur auswählen, dann Zielfeld auswählen).</li>
            <li>Der Computergegner (Schwarz) macht nach einer kurzen Verzögerung automatisch einen Zug.</li>
            <li>Ein UI-Indikator zeigt an, welcher Spieler am Zug ist.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">5. Zugregeln der Figuren</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Löwe (L):</strong>
              <ul className="list-circle list-inside ml-4">
                <li>Zieht 1 oder 2 Felder weit in jede Richtung (horizontal, vertikal, diagonal).</li>
                <li>Kann nicht über andere Figuren springen.</li>
                <li>Kann gegnerische Figuren schlagen.</li>
                <li><strong>Pause:</strong> Nach einer Bewegung muss der Löwe im nächsten Zug aussetzen.</li>
              </ul>
            </li>
            <li><strong>Giraffe (G):</strong>
              <ul className="list-circle list-inside ml-4">
                <li>Zieht maximal 2 Felder weit horizontal oder vertikal.</li>
                <li>Darf nicht über andere Figuren springen (kann eine Kluft bei einem 2-Felder-Zug nicht überspringen, wenn das Zwischenfeld eine Kluft ist; kann einen Sumpf bei einem 2-Felder-Zug nicht überspringen, wenn das Zwischenfeld ein Sumpf ist).</li>
                <li>Kann gegnerische Figuren schlagen.</li>
                <li>Kann Hügel (H) betreten. Andere Figuren nicht.</li>
                <li>Kann Sumpf (S) nicht betreten.</li>
              </ul>
            </li>
            <li><strong>Gazelle (Z):</strong>
              <ul className="list-circle list-inside ml-4">
                <li><strong>Bewegung:</strong> Zieht 1 Feld geradeaus (Spieler Weiß: Reihenindex sinkt; KI Schwarz: Reihenindex steigt).</li>
                <li><strong>Schlagen:</strong> Schlägt 1 Feld diagonal vorwärts. Kann gegnerische Gazellen schlagen.</li>
                <li>Kann gegnerischen Löwen NICHT schlagen.</li>
                <li>Kann gegnerische Giraffen NICHT schlagen.</li>
                <li>Landet auf Sumpf (S): Muss nächste Runde pausieren.</li>
                <li>Kann Hügel (H) nicht betreten.</li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">6. Schlagregeln</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Standard: Figur zieht auf besetztes Feld, gegnerische Figur wird entfernt.</li>
            <li>Ausnahme 1: Gazelle kann keinen Löwen und keine Giraffe schlagen.</li>
            <li>Ausnahme 2: Löwe kann nur von gegn. Löwen oder Giraffe geschlagen werden.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">7. Spezialfeld-Effekte</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Kluft (K):</strong> Figur wird in ihre spezifische, zufällige Richtung verschoben.</li>
            <li><strong>Sumpf (S):</strong> Löwe/Gazelle pausieren nächste Runde. Giraffe kann nicht betreten/überspringen.</li>
            <li><strong>Hügel (H):</strong> Nur Giraffen können betreten.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-semibold text-md mt-2">8. Sonstiges</h4>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>Highlighting:</strong> Angeklickte, spielbare Figuren des aktuellen Spielers werden markiert.</li>
            <li><strong>Zugindikatoren:</strong> Gültige Zielfelder werden markiert.</li>
            <li><strong>Reset:</strong> Bei Spielende wird nach 3 Sekunden automatisch ein neues Spiel gestartet und das Tutorial angezeigt.</li>
          </ul>
        </section>
      </DialogDescription>
    </ScrollArea>
  );
};

const TerrainLegendIcon: React.FC<{terrain: TerrainType, riftDirection?: RiftDirection, size?: number, className?: string}> = ({ terrain, riftDirection, size = 16, className }) => {
  let iconElement: React.ReactNode = null;
  const colorClass =
    terrain === 'rift' ? 'text-destructive' :
    terrain === 'swamp' ? 'text-emerald-600' :
    terrain === 'hill' ? 'text-yellow-700' : '';

  switch (terrain) {
    case 'rift':
      iconElement = (
        <div className="flex flex-col items-center">
          <Wind size={size} className={colorClass} />
          {riftDirection && (
            riftDirection.dRow === -1 ? <ArrowUp size={size * 0.75} className={colorClass} /> :
            riftDirection.dRow === 1 ? <ArrowDown size={size * 0.75} className={colorClass} /> :
            riftDirection.dCol === -1 ? <ArrowLeft size={size * 0.75} className={colorClass} /> :
            riftDirection.dCol === 1 ? <ArrowRight size={size * 0.75} className={colorClass} /> : null
          )}
        </div>
      );
      break;
    case 'swamp':
      iconElement = <Waves size={size} className={colorClass} />;
      break;
    case 'hill':
      iconElement = <Mountain size={size} className={colorClass} />;
      break;
    default:
      return null;
  }
  return <span className={cn("flex items-center justify-center", className)}>{iconElement}</span>;
};

const PieceLegendIcon: React.FC<{char: string, playerType: 'human' | 'ai'}> = ({ char, playerType }) => {
  const bgColor = playerType === 'human' ? 'bg-primary' : 'bg-accent';
  const textColor = playerType === 'human' ? 'text-primary-foreground' : 'text-accent-foreground';

  return (
    <span className={cn(
        "flex items-center justify-center w-6 h-6 rounded-full text-sm font-bold",
        bgColor,
        textColor
      )}
    >
      {char}
    </span>
  );
};


export default function SavannahChasePage() {
  const [gameState, setGameState] = useState<GameState>(initializeGameState);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const { toast } = useToast();

  const colLabels = Array.from({ length: BOARD_COLS }, (_, i) => String.fromCharCode(65 + i));
  const rowLabelsForDisplay = Array.from({ length: BOARD_ROWS }, (_, i) => (BOARD_ROWS - i).toString());


  const handleStartGame = () => {
    setShowTutorial(false);
    setGameState(initializeGameState());
  };

  const checkWinCondition = useCallback((
    humanPlayerCapturesAiScore: CapturedPieces,
    aiPlayerCapturesHumanScore: CapturedPieces
  ): PlayerType | null => {
    if (humanPlayerCapturesAiScore.lion >= 1 || humanPlayerCapturesAiScore.gazelle >= 5) return 'human';
    if (aiPlayerCapturesHumanScore.lion >= 1 || aiPlayerCapturesHumanScore.gazelle >= 5) return 'ai';
    return null;
  }, []);

  const calculateValidMoves = useCallback((
    pieceId: string,
    currentBoard: Board,
    currentPieces: Record<string, Piece>,
    lionPlayerCurrentlyPaused: PlayerType | null,
    swampPausedPieceInfo: { pieceId: string; player: PlayerType } | null
  ): { row: number; col: number }[] => {
    const piece = currentPieces[pieceId];
    if (!piece) return [];

    if (piece.animal === 'lion' && lionPlayerCurrentlyPaused === piece.player) {
      return [];
    }

    if ((piece.animal === 'lion' || piece.animal === 'gazelle') &&
        swampPausedPieceInfo?.player === piece.player &&
        swampPausedPieceInfo?.pieceId === piece.id) {
      return [];
    }

    let moves: { row: number; col: number }[] = [];
    const { row: startRow, col: startCol } = piece.position;

    if (piece.animal === 'lion') {
      const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
      ];
      for (const [dr, dc] of directions) {
        for (let dist = 1; dist <= 2; dist++) { // Max 2 fields
          const r = startRow + dr * dist;
          const c = startCol + dc * dist;

          if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) break;

          const targetSquare = currentBoard[r][c];
          if (targetSquare.terrain === 'hill') continue;

          if (dist === 2) {
            const intermediateRow = startRow + dr;
            const intermediateCol = startCol + dc;
            if (currentBoard[intermediateRow][intermediateCol].pieceId) break;
             if (currentBoard[intermediateRow][intermediateCol].terrain === 'hill') break;
          }

          if (targetSquare.pieceId) {
            const targetPiece = currentPieces[targetSquare.pieceId];
            if (targetPiece.player !== piece.player) {
              moves.push({ row: r, col: c });
            }
            break;
          }
          moves.push({ row: r, col: c });
        }
      }
    } else if (piece.animal === 'giraffe') {
      const directions = [[-1,0], [1,0], [0,-1], [0,1]];
      for (const [dr, dc] of directions) {
        for (let dist = 1; dist <= 2; dist++) {
          const r = startRow + dr * dist;
          const c = startCol + dc * dist;

          if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) break;

          const targetSquare = currentBoard[r][c];
          if (targetSquare.terrain === 'swamp') continue;

          if (dist === 2) {
            const intermediateRow = startRow + dr;
            const intermediateCol = startCol + dc;
            if (currentBoard[intermediateRow][intermediateCol].pieceId) break;
            if (currentBoard[intermediateRow][intermediateCol].terrain === 'rift') continue;
            if (currentBoard[intermediateRow][intermediateCol].terrain === 'swamp') continue;
          }

          if (targetSquare.pieceId) {
            const targetPiece = currentPieces[targetSquare.pieceId];
            if (targetPiece.player !== piece.player) {
              moves.push({ row: r, col: c });
            }
            break;
          }
          moves.push({ row: r, col: c });
        }
      }
    } else if (piece.animal === 'gazelle') {
      const forwardDir = piece.player === 'human' ? -1 : 1; // Spieler (Weiß, Unten) zieht zu niedrigerem Index, KI (Schwarz, Oben) zu höherem

      const moveR = startRow + forwardDir;
      if (moveR >= 0 && moveR < BOARD_ROWS) {
        const targetSquare = currentBoard[moveR][startCol];
        if (targetSquare.terrain === 'hill') {
          // Gazelle cannot enter hill
        } else if (!targetSquare.pieceId) {
          moves.push({ row: moveR, col: startCol });
        }
      }

      const captureCols = [startCol - 1, startCol + 1];
      for (const captureC of captureCols) {
        const captureR = startRow + forwardDir;
        if (captureR >= 0 && captureR < BOARD_ROWS && captureC >=0 && captureC < BOARD_COLS) {
          const targetSquare = currentBoard[captureR][captureC];
          if (targetSquare.terrain === 'hill') {
            // Gazelle cannot capture on hill
          } else if (targetSquare.pieceId) {
            const targetPiece = currentPieces[targetSquare.pieceId];
            if (targetPiece.player !== piece.player && targetPiece.animal === 'gazelle') { // Only other gazelles
              moves.push({ row: captureR, col: captureC });
            }
          }
        }
      }
    }
    return moves;
  }, []);

  const processSpecialFieldEffects = useCallback((
    movedPieceId: string,
    targetRow: number,
    targetCol: number,
    currentBoard: Board,
    currentPieces: Record<string, Piece>
  ): { board: Board, pieces: Record<string, Piece>, finalPosition: {row: number, col: number}, messageUpdate?: string } => {
    let newBoard = currentBoard.map(r => r.map(s => ({ ...s } as Square)));
    let newPieces = JSON.parse(JSON.stringify(currentPieces));
    let finalPos = { row: targetRow, col: targetCol };
    let pieceToUpdate = newPieces[movedPieceId];
    let messageUpdate;

    const originalPos = currentPieces[movedPieceId].position;
    const landedSquare = newBoard[finalPos.row][finalPos.col];

    if (originalPos.row !== finalPos.row || originalPos.col !== finalPos.col) {
         newBoard[originalPos.row][originalPos.col].pieceId = null;
    }

    if (landedSquare.terrain === 'rift') {
        newBoard[finalPos.row][finalPos.col].pieceId = null;
    }


    if (landedSquare.terrain === 'rift' && landedSquare.riftDirection) {
        const pushDirection = landedSquare.riftDirection;
        const pieceOwnerName = pieceToUpdate.player === 'human' ? gameState.playerTwoName : gameState.playerOneName;
        const pieceAnimalName = pieceToUpdate.animal.charAt(0).toUpperCase() + pieceToUpdate.animal.slice(1);
        const directionNames: Record<string, string> = { "-1,0": "Norden", "1,0": "Süden", "0,-1": "Westen", "0,1": "Osten"};
        const dirKey = `${pushDirection.dRow},${pushDirection.dCol}`;
        messageUpdate = `${pieceOwnerName} ${pieceAnimalName} landete in einer Kluft! Wird nach ${directionNames[dirKey] || 'unbekannte Richtung'} verschoben.`;
        toast({ title: "Kluft!", description: messageUpdate, duration: 3500 });

        let currentPushRow = finalPos.row;
        let currentPushCol = finalPos.col;

        // eslint-disable-next-line no-constant-condition
        while(true) {
            const nextRow = currentPushRow + pushDirection.dRow;
            const nextCol = currentPushCol + pushDirection.dCol;

            if (nextRow < 0 || nextRow >= BOARD_ROWS || nextCol < 0 || nextCol >= BOARD_COLS) {
                break;
            }
            if (newBoard[nextRow][nextCol].pieceId) {
                break;
            }
            currentPushRow = nextRow;
            currentPushCol = nextCol;
        }
        finalPos = {row: currentPushRow, col: currentPushCol};
    }

    newPieces[movedPieceId] = { ...pieceToUpdate, position: finalPos };
    newBoard[finalPos.row][finalPos.col].pieceId = movedPieceId;

    return { board: newBoard, pieces: newPieces, finalPosition: finalPos, messageUpdate };
  }, [toast, gameState.playerTwoName, gameState.playerOneName]);


  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameState.isGameOver || isLoadingAI || gameState.currentPlayer !== 'human') return;

    const clickedSquare = gameState.board[row][col];
    const pieceInClickedSquare = clickedSquare.pieceId ? gameState.pieces[clickedSquare.pieceId] : null;

    let newSwampSkipTurnForPiece = gameState.swampSkipTurnForPiece;
    if (newSwampSkipTurnForPiece?.player === 'human') {
        newSwampSkipTurnForPiece = null;
    }

    if (gameState.selectedPieceId) {
      const selectedPiece = gameState.pieces[gameState.selectedPieceId];
      const isValidMoveTarget = gameState.validMoves.some(m => m.row === row && m.col === col);

      if (isValidMoveTarget) {
        let newPieces = JSON.parse(JSON.stringify(gameState.pieces));
        let newBoard = gameState.board.map(r => r.map(s => ({ ...s } as Square)));
        let newHumanPlayerCapturesAiScore = { ...gameState.humanCapturedAIScore };

        let currentLionMovedLastTurn = gameState.lionMovedLastTurn;
        if (selectedPiece.animal === 'lion') {
            currentLionMovedLastTurn = selectedPiece.player;
        } else if (gameState.lionMovedLastTurn === 'human') {
            currentLionMovedLastTurn = null;
        }

        let moveMessage = "";
        const targetSquareContentOriginalBoard = gameState.board[row][col];

        if (targetSquareContentOriginalBoard.pieceId) {
          const capturedPieceOriginal = gameState.pieces[targetSquareContentOriginalBoard.pieceId];
          if (capturedPieceOriginal.player === 'ai') {
            if (capturedPieceOriginal.animal === 'lion' && !(selectedPiece.animal === 'lion' || selectedPiece.animal === 'giraffe')) {
               toast({ title: "Ungültiger Fang", description: `Deine ${selectedPiece.animal} kann keinen Löwen fangen. Nur ein Löwe oder eine Giraffe kann das.`, variant: "destructive", duration: 4000 });
               setGameState(prev => ({ ...prev, selectedPieceId: null, validMoves: [] }));
               return;
            }
             if (selectedPiece.animal === 'gazelle' && (capturedPieceOriginal.animal === 'lion' || capturedPieceOriginal.animal === 'giraffe')) { // Gazelle can't capture lion or giraffe
                toast({ title: "Ungültiger Fang", description: `Deine Gazelle kann keine ${capturedPieceOriginal.animal} fangen.`, variant: "destructive", duration: 4000 });
                setGameState(prev => ({ ...prev, selectedPieceId: null, validMoves: [] }));
                return;
            }

            delete newPieces[targetSquareContentOriginalBoard.pieceId];
            newHumanPlayerCapturesAiScore[capturedPieceOriginal.animal]++;
            moveMessage = `${gameState.playerTwoName} ${selectedPiece.animal} hat ${gameState.playerOneName} ${capturedPieceOriginal.animal} auf (${colLabels[col]}${rowLabelsForDisplay[row]}) geschlagen.`;
            toast({ title: "Gefangen!", description: moveMessage, duration: 3000 });
          } else {
            console.error("Fehler: Versuch, eigene Figur zu schlagen, obwohl als gültiger Zug markiert.");
            setGameState(prev => ({ ...prev, selectedPieceId: null, validMoves: [] }));
            return;
          }
        }

        const originalPiecePos = selectedPiece.position;
        newBoard[originalPiecePos.row][originalPiecePos.col].pieceId = null;

        const effectResult = processSpecialFieldEffects(selectedPiece.id, row, col, newBoard, newPieces);
        newBoard = effectResult.board;
        newPieces = effectResult.pieces;
        const finalPiecePos = newPieces[selectedPiece.id].position;


        const finalLandedSquare = newBoard[finalPiecePos.row][finalPiecePos.col];
        if ((selectedPiece.animal === 'lion' || selectedPiece.animal === 'gazelle') && finalLandedSquare.terrain === 'swamp') {
            newSwampSkipTurnForPiece = { pieceId: selectedPiece.id, player: 'human' };
            const swampMessage = `${gameState.playerTwoName} ${selectedPiece.animal} landete auf einem Sumpf! Pausiert nächste Runde.`;
            if (!moveMessage) moveMessage = swampMessage; else moveMessage += ` ${swampMessage}`;
            toast({ title: "Sumpf!", description: swampMessage, duration: 3000 });
        }

        if (effectResult.messageUpdate && !moveMessage) moveMessage = effectResult.messageUpdate;
        else if (effectResult.messageUpdate && moveMessage && !moveMessage.includes(effectResult.messageUpdate)) moveMessage += " " + effectResult.messageUpdate;

        const winner = checkWinCondition(newHumanPlayerCapturesAiScore, gameState.aiCapturedHumanScore);
        let nextPlayer: PlayerType = 'ai';
        let gameStatusMessage = winner
          ? `${winner === 'human' ? gameState.playerTwoName : gameState.playerOneName} gewinnt!`
          : `${gameState.playerOneName} ist am Zug.`;

        if (!moveMessage && !winner) {
             gameStatusMessage = `${gameState.playerTwoName} ${selectedPiece.animal} von (${colLabels[originalPiecePos.col]}${rowLabelsForDisplay[originalPiecePos.row]}) nach (${colLabels[finalPiecePos.col]}${rowLabelsForDisplay[finalPiecePos.row]}). ${gameStatusMessage}`;
        } else if (moveMessage && !winner) {
            gameStatusMessage = `${moveMessage} ${gameStatusMessage}`;
        } else if (moveMessage && winner) {
            gameStatusMessage = `${moveMessage} ${gameStatusMessage}`;
        }


        setGameState(prev => ({
          ...prev,
          board: newBoard,
          pieces: newPieces,
          currentPlayer: winner ? prev.currentPlayer : nextPlayer,
          selectedPieceId: null,
          validMoves: [],
          winner,
          isGameOver: !!winner,
          message: gameStatusMessage,
          humanCapturedAIScore: newHumanPlayerCapturesAiScore,
          lionMovedLastTurn: currentLionMovedLastTurn,
          swampSkipTurnForPiece: newSwampSkipTurnForPiece,
        }));

      } else {
        if (pieceInClickedSquare && pieceInClickedSquare.player === 'human') {
            if (pieceInClickedSquare.id === gameState.selectedPieceId) {
                 setGameState(prev => ({ ...prev, selectedPieceId: null, validMoves: [], message: `${gameState.playerTwoName} ist am Zug. Wähle eine Figur.` }));
            } else {
                const pieceMoves = calculateValidMoves(pieceInClickedSquare.id, gameState.board, gameState.pieces, gameState.lionMovedLastTurn, gameState.swampSkipTurnForPiece);
                let messageForSelection = `${getAnimalChar(pieceInClickedSquare.animal)} bei (${colLabels[pieceInClickedSquare.position.col]}${rowLabelsForDisplay[pieceInClickedSquare.position.row]}) ausgewählt. Wähle ein Zielfeld.`;

                if (pieceInClickedSquare.animal === 'lion' && gameState.lionMovedLastTurn === 'human') {
                    toast({ title: "Löwe Pausiert", description: "Dein Löwe muss diese Runde aussetzen." });
                    messageForSelection = "Löwe ist pausiert. Wähle eine andere Figur.";
                } else if ((pieceInClickedSquare.animal === 'lion' || pieceInClickedSquare.animal === 'gazelle') &&
                           gameState.swampSkipTurnForPiece?.pieceId === pieceInClickedSquare.id &&
                           gameState.swampSkipTurnForPiece?.player === 'human') {
                    toast({ title: "Sumpfpause", description: `Diese ${pieceInClickedSquare.animal} ist diese Runde durch den Sumpf pausiert.`});
                    messageForSelection = `Diese ${pieceInClickedSquare.animal} ist Sumpf-pausiert. Wähle eine andere Figur.`;
                } else if (pieceMoves.length === 0) {
                    toast({ title: "Keine Züge", description: `Diese ${pieceInClickedSquare.animal} hat keine gültigen Züge.` });
                    messageForSelection = `Diese ${pieceInClickedSquare.animal} hat keine gültigen Züge. Wähle eine andere Figur.`;
                }
                setGameState(prev => ({
                    ...prev,
                    selectedPieceId: pieceInClickedSquare.id,
                    validMoves: pieceMoves,
                    message: messageForSelection,
                }));
            }
        } else {
          setGameState(prev => ({ ...prev, selectedPieceId: null, validMoves: [], message: `Ungültiger Zug. ${gameState.playerTwoName} ist am Zug. Wähle eine Figur.`}));
        }
      }
    } else if (pieceInClickedSquare && pieceInClickedSquare.player === 'human') {
        const pieceMoves = calculateValidMoves(pieceInClickedSquare.id, gameState.board, gameState.pieces, gameState.lionMovedLastTurn, gameState.swampSkipTurnForPiece);
        let messageForSelection = `${getAnimalChar(pieceInClickedSquare.animal)} bei (${colLabels[pieceInClickedSquare.position.col]}${rowLabelsForDisplay[pieceInClickedSquare.position.row]}) ausgewählt. Gültige Züge werden angezeigt.`;

        if (pieceInClickedSquare.animal === 'lion' && gameState.lionMovedLastTurn === 'human') {
             toast({ title: "Löwe Pausiert", description: "Dein Löwe muss diese Runde aussetzen." });
             messageForSelection = "Löwe ist pausiert. Wähle eine andere Figur.";
        } else if ((pieceInClickedSquare.animal === 'lion' || pieceInClickedSquare.animal === 'gazelle') &&
                   gameState.swampSkipTurnForPiece?.pieceId === pieceInClickedSquare.id &&
                   gameState.swampSkipTurnForPiece?.player === 'human') {
             toast({ title: "Sumpfpause", description: `Diese ${pieceInClickedSquare.animal} ist diese Runde durch den Sumpf pausiert.`});
             messageForSelection = `Diese ${pieceInClickedSquare.animal} ist Sumpf-pausiert. Wähle eine andere Figur.`;
        } else if (pieceMoves.length === 0) {
            toast({ title: "Keine Züge", description: `Diese ${pieceInClickedSquare.animal} hat keine gültigen Züge.` });
            messageForSelection = `Keine Züge für diese ${pieceInClickedSquare.animal}. Wähle eine andere Figur.`;
        }
         setGameState(prev => ({
            ...prev,
            selectedPieceId: pieceInClickedSquare.id,
            validMoves: pieceMoves,
            message: messageForSelection,
            swampSkipTurnForPiece: newSwampSkipTurnForPiece,
         }));
    } else {
        setGameState(prev => ({ ...prev, message: `${gameState.playerTwoName} ist am Zug. Wähle eine deiner Figuren.`, swampSkipTurnForPiece: newSwampSkipTurnForPiece }));
    }
  }, [gameState, calculateValidMoves, checkWinCondition, toast, processSpecialFieldEffects, isLoadingAI, colLabels, rowLabelsForDisplay]);

  const handleAiAnalyze = async () => {
    if (isLoadingAI) return;
    setIsLoadingAI(true);
    try {
      const boardString = getBoardString(gameState.board, gameState.pieces);
      const analysisResult = await analyzeGameState({
        boardState: boardString,
        playerOneName: gameState.playerOneName, // KI (Schwarz)
        playerTwoName: gameState.playerTwoName, // Spieler (Weiß)
      });
      toast({
        title: "KI-Spielanalyse",
        description: (
          <div className="text-xs">
            <p><strong>{gameState.playerOneName} (KI):</strong> {analysisResult.playerOneSummary}</p>
            <p><strong>{gameState.playerTwoName} (Du):</strong> {analysisResult.playerTwoSummary}</p>
            <p><strong>Gesamt:</strong> {analysisResult.overallAssessment}</p>
          </div>
        ),
        duration: 9000
      });
    } catch (error) {
      console.error("Error analyzing game state:", error);
      toast({ title: "KI-Fehler", description: "Spielzustand konnte nicht analysiert werden.", variant: "destructive"});
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAiSuggest = async () => {
    if (isLoadingAI) return;
    setIsLoadingAI(true);
    try {
      const boardString = getBoardString(gameState.board, gameState.pieces);
      const currentTurnPlayerNameForSuggestion = gameState.currentPlayer === 'human' ? gameState.playerTwoName : gameState.playerOneName;
      const playerColorForSuggestion = gameState.currentPlayer === 'human' ? 'Weiß, Unten' : 'Schwarz, Oben';

      let playerTurnDescription = `${currentTurnPlayerNameForSuggestion} (${playerColorForSuggestion})`;

      if (gameState.lionMovedLastTurn === gameState.currentPlayer) {
        playerTurnDescription += ` (Löwe ist pausiert).`;
      }
      if (gameState.swampSkipTurnForPiece?.player === gameState.currentPlayer &&
          gameState.pieces[gameState.swampSkipTurnForPiece.pieceId]) {
        const pieceData = gameState.pieces[gameState.swampSkipTurnForPiece.pieceId];
        playerTurnDescription += ` (${pieceData.animal} bei (${colLabels[pieceData.position.col]}${rowLabelsForDisplay[pieceData.position.row]}) ist Sumpf-pausiert).`;
      }

      const suggestionResult = await suggestMove({
        boardState: boardString,
        playerTurn: playerTurnDescription,
      });
      const suggestionText = (suggestionResult as { suggestedMove: string }).suggestedMove;
      toast({ title: `KI-Vorschlag für ${currentTurnPlayerNameForSuggestion}`, description: suggestionText || "KI konnte keinen Vorschlag ermitteln."});
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
      toast({ title: "KI-Fehler", description: "KI-Vorschlag konnte nicht erhalten werden.", variant: "destructive"});
    } finally {
      setIsLoadingAI(false);
    }
  };

  useEffect(() => {
    if (gameState.currentPlayer === 'ai' && !gameState.isGameOver && !isLoadingAI) {
      setIsLoadingAI(true);
      const performAiMove = async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        let currentSwampSkipTurnForPieceAi = gameState.swampSkipTurnForPiece;
        if (currentSwampSkipTurnForPieceAi?.player === 'ai') {
            currentSwampSkipTurnForPieceAi = null;
        }

        let allAiMoves: { pieceId: string, move: {row: number, col: number}, piece: Piece, isCapture: boolean, capturedPieceAnimal?: AnimalType }[] = [];
        const aiPieceIds = Object.keys(gameState.pieces).filter(id => gameState.pieces[id].player === 'ai');

        for (const pieceId of aiPieceIds) {
          const piece = gameState.pieces[pieceId];
          const validMovesForPiece = calculateValidMoves(pieceId, gameState.board, gameState.pieces, gameState.lionMovedLastTurn, gameState.swampSkipTurnForPiece);

          for (const move of validMovesForPiece) {
            const targetSquare = gameState.board[move.row][move.col];
            let isCapture = false;
            let isValidFinalMove = true;
            let capturedPieceAnimal: AnimalType | undefined = undefined;

            if (targetSquare.pieceId) {
                const targetPieceDetails = gameState.pieces[targetSquare.pieceId];
                if (targetPieceDetails.player === 'ai') {
                    isValidFinalMove = false;
                } else {
                    capturedPieceAnimal = targetPieceDetails.animal;
                    if (targetPieceDetails.animal === 'lion' && !(piece.animal === 'lion' || piece.animal === 'giraffe')) {
                        isValidFinalMove = false;
                    }
                    if (piece.animal === 'gazelle' && (targetPieceDetails.animal === 'lion' || targetPieceDetails.animal === 'giraffe')) {
                        isValidFinalMove = false;
                    }
                    if (isValidFinalMove) isCapture = true;
                }
            }
            if (isValidFinalMove) {
              allAiMoves.push({ pieceId, move, piece, isCapture, capturedPieceAnimal });
            }
          }
        }

        let chosenMoveData = null;
        const captureMoves = allAiMoves.filter(m => m.isCapture);

        if (captureMoves.length > 0) {
          const lionCaptures = captureMoves.filter(m => m.capturedPieceAnimal === 'lion');
          const giraffeCaptures = captureMoves.filter(m => m.capturedPieceAnimal === 'giraffe');
          const gazelleCaptures = captureMoves.filter(m => m.capturedPieceAnimal === 'gazelle');

          if (lionCaptures.length > 0) chosenMoveData = lionCaptures[Math.floor(Math.random() * lionCaptures.length)];
          else if (giraffeCaptures.length > 0) chosenMoveData = giraffeCaptures[Math.floor(Math.random() * giraffeCaptures.length)];
          else if (gazelleCaptures.length > 0) chosenMoveData = gazelleCaptures[Math.floor(Math.random() * gazelleCaptures.length)];
        }

        if (!chosenMoveData && allAiMoves.length > 0) {
          const nonRiftMoves = allAiMoves.filter(m => gameState.board[m.move.row][m.move.col].terrain !== 'rift');
          if (nonRiftMoves.length > 0) {
            chosenMoveData = nonRiftMoves[Math.floor(Math.random() * nonRiftMoves.length)];
          } else {
            chosenMoveData = allAiMoves[Math.floor(Math.random() * allAiMoves.length)];
          }
        }


        if (chosenMoveData) {
          const { pieceId: aiPieceIdToMove, move: aiMoveToMake, piece: aiSelectedPiece } = chosenMoveData;

          let newPieces = JSON.parse(JSON.stringify(gameState.pieces));
          let newBoard = gameState.board.map(r => r.map(s => ({ ...s } as Square)));
          let newAiPlayerCapturesHumanScore = { ...gameState.aiCapturedHumanScore };

          let currentLionMovedLastTurn = gameState.lionMovedLastTurn;
          if (aiSelectedPiece.animal === 'lion') {
              currentLionMovedLastTurn = 'ai';
          } else if (gameState.lionMovedLastTurn === 'ai') {
             currentLionMovedLastTurn = null;
          }

          let moveMessage = "";
          const originalAiPiecePos = aiSelectedPiece.position;
          newBoard[originalAiPiecePos.row][originalAiPiecePos.col].pieceId = null;

          const targetSquareContentOriginalBoard = gameState.board[aiMoveToMake.row][aiMoveToMake.col];
          if (targetSquareContentOriginalBoard.pieceId) {
            const capturedPieceOriginal = gameState.pieces[targetSquareContentOriginalBoard.pieceId];
            if (capturedPieceOriginal.player === 'human') {
                delete newPieces[targetSquareContentOriginalBoard.pieceId];
                newAiPlayerCapturesHumanScore[capturedPieceOriginal.animal]++;
                moveMessage = `${gameState.playerOneName} ${aiSelectedPiece.animal} hat ${gameState.playerTwoName} ${capturedPieceOriginal.animal} auf (${colLabels[aiMoveToMake.col]}${rowLabelsForDisplay[aiMoveToMake.row]}) geschlagen.`;
                toast({ title: "KI-Fang!", description: moveMessage, duration: 3000 });
            }
          }

          const effectResult = processSpecialFieldEffects(aiSelectedPiece.id, aiMoveToMake.row, aiMoveToMake.col, newBoard, newPieces);
          newBoard = effectResult.board;
          newPieces = effectResult.pieces;
          const finalAiPiecePos = newPieces[aiSelectedPiece.id].position;


          const finalLandedSquare = newBoard[finalAiPiecePos.row][finalAiPiecePos.col];
          if ((aiSelectedPiece.animal === 'lion' || aiSelectedPiece.animal === 'gazelle') && finalLandedSquare.terrain === 'swamp') {
              currentSwampSkipTurnForPieceAi = { pieceId: aiSelectedPiece.id, player: 'ai' };
              const swampMessage = `${gameState.playerOneName} ${aiSelectedPiece.animal} landete auf einem Sumpf! Pausiert nächste Runde.`;
              if (!moveMessage) moveMessage = swampMessage; else moveMessage += ` ${swampMessage}`;
              toast({ title: "Sumpf!", description: swampMessage, duration: 3000 });
          }

          if (effectResult.messageUpdate && !moveMessage) moveMessage = effectResult.messageUpdate;
          else if (effectResult.messageUpdate && moveMessage && !moveMessage.includes(effectResult.messageUpdate)) moveMessage += " " + effectResult.messageUpdate;

          const winner = checkWinCondition(gameState.humanCapturedAIScore, newAiPlayerCapturesHumanScore);
          let nextPlayerTurn: PlayerType = 'human';
          let gameStatusMessage = winner
            ? `${winner === 'human' ? gameState.playerTwoName : gameState.playerOneName} gewinnt!`
            : `${gameState.playerTwoName} ist am Zug.`;

          if (!moveMessage && !winner) {
             gameStatusMessage = `${gameState.playerOneName} ${aiSelectedPiece.animal} von (${colLabels[originalAiPiecePos.col]}${rowLabelsForDisplay[originalAiPiecePos.row]}) nach (${colLabels[finalAiPiecePos.col]}${rowLabelsForDisplay[finalAiPiecePos.row]}). ${gameStatusMessage}`;
          } else if (moveMessage && !winner) {
            gameStatusMessage = `${moveMessage} ${gameStatusMessage}`;
          } else if (moveMessage && winner) {
            gameStatusMessage = `${moveMessage} ${gameStatusMessage}`;
          }


          setGameState(prev => ({
            ...prev,
            board: newBoard,
            pieces: newPieces,
            currentPlayer: winner ? prev.currentPlayer : nextPlayerTurn,
            winner,
            isGameOver: !!winner,
            message: gameStatusMessage,
            aiCapturedHumanScore: newAiPlayerCapturesHumanScore,
            lionMovedLastTurn: currentLionMovedLastTurn,
            swampSkipTurnForPiece: currentSwampSkipTurnForPieceAi,
          }));

        } else {
           let currentLionMovedLastTurn = gameState.lionMovedLastTurn;
           if (gameState.lionMovedLastTurn === 'ai') {
             currentLionMovedLastTurn = null;
           }
          setGameState(prev => ({
            ...prev,
            currentPlayer: 'human',
            message: `${gameState.playerOneName} hat keine gültigen Züge. ${gameState.playerTwoName} ist am Zug.`,
            lionMovedLastTurn: currentLionMovedLastTurn,
            swampSkipTurnForPiece: currentSwampSkipTurnForPieceAi,
          }));
        }
        setIsLoadingAI(false);
      };
      performAiMove();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayer, gameState.isGameOver, colLabels, rowLabelsForDisplay]);

  const handleResetGame = useCallback(() => {
    setShowTutorial(true);
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (gameState.isGameOver && !showTutorial) {
      toast({
        title: "Spiel vorbei!",
        description: `${gameState.winner === 'human' ? gameState.playerTwoName : gameState.playerOneName} gewinnt! Spiel wird in 3 Sekunden zurückgesetzt...`,
        duration: 3000,
      });
      timeoutId = setTimeout(() => {
        handleResetGame();
      }, 3000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [gameState.isGameOver, gameState.winner, gameState.playerOneName, gameState.playerTwoName, handleResetGame, toast, showTutorial]);

  const terrainLegendItems: {terrain: TerrainType, riftDir?: RiftDirection, name: string, description: string}[] = [
    {terrain: 'rift', riftDir: {dRow: -1, dCol: 0}, name: "Kluft (Nord)", description: "Figur wird nach Norden verschoben."},
    {terrain: 'rift', riftDir: {dRow: 1, dCol: 0}, name: "Kluft (Süd)", description: "Figur wird nach Süden verschoben."},
    {terrain: 'rift', riftDir: {dRow: 0, dCol: -1}, name: "Kluft (West)", description: "Figur wird nach Westen verschoben."},
    {terrain: 'rift', riftDir: {dRow: 0, dCol: 1}, name: "Kluft (Ost)", description: "Figur wird nach Osten verschoben."},
    {terrain: 'swamp', name: "Sumpf", description: "Löwe/Gazelle pausieren nächste Runde. Giraffe kann nicht betreten/überspringen."},
    {terrain: 'hill', name: "Hügel", description: "Nur Giraffen können betreten."},
  ];

  const pieceLegendItems: {char: string, name: string, playerType: 'human' | 'ai', rule: string}[] = [
    {char: 'L', name: `Löwe (${gameState.playerTwoName})`, playerType: 'human', rule: "Zieht 1-2 Felder (jede Richtung). Pausiert nächste Runde."},
    {char: 'G', name: `Giraffe (${gameState.playerTwoName})`, playerType: 'human', rule: "Zieht max. 2 Felder (H/V). Kann Sumpf nicht betreten/überspringen. Kann Hügel betreten. Kann Kluft nicht überspringen."},
    {char: 'Z', name: `Gazelle (${gameState.playerTwoName})`, playerType: 'human', rule: "Zieht 1 Feld vorwärts. Schlägt 1 Feld diag. vorwärts (nur gegn. Gazellen). Kann L/G nicht schlagen."},
    {char: 'L', name: `Löwe (${gameState.playerOneName})`, playerType: 'ai', rule: "Zieht 1-2 Felder (jede Richtung). Pausiert nächste Runde."},
    {char: 'G', name: `Giraffe (${gameState.playerOneName})`, playerType: 'ai', rule: "Zieht max. 2 Felder (H/V). Kann Sumpf nicht betreten/überspringen. Kann Hügel betreten. Kann Kluft nicht überspringen."},
    {char: 'Z', name: `Gazelle (${gameState.playerOneName})`, playerType: 'ai', rule: "Zieht 1 Feld vorwärts. Schlägt 1 Feld diag. vorwärts (nur gegn. Gazellen). Kann L/G nicht schlagen."},
  ];


  if (showTutorial) {
    return <Tutorial onStartGame={handleStartGame} />;
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="absolute top-4 left-4 z-50 flex gap-2">
        <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="bg-card hover:bg-card/80 text-card-foreground">
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">Spielanleitung öffnen</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-primary text-2xl">Spielanleitung: Savannah Chase</DialogTitle>
            </DialogHeader>
            <GameRulesContent />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Schließen
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="icon" onClick={handleResetGame} title="Spiel beenden und zum Tutorial" className="bg-card hover:bg-card/80 text-card-foreground">
            <RotateCcw className="h-5 w-5" />
            <span className="sr-only">Spiel beenden</span>
        </Button>
      </div>

      <header className="mb-6 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary tracking-tight">Savannah Chase</h1>
      </header>

      <main className="flex flex-col lg:flex-row gap-6 md:gap-8 w-full max-w-6xl">
        <section className="flex-grow flex flex-col items-center lg:items-start">
          <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto">
            <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-x-1 gap-y-0.5 items-center w-full">
              <div className="w-6 h-6"></div>
              <div className="flex justify-around items-center w-full">
                {colLabels.map((label) => (
                  <span key={`top-${label}`} className="text-xs font-medium text-muted-foreground flex-1 text-center h-6 flex items-center justify-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="w-6 h-6"></div>
              <div className="flex flex-col justify-around items-center h-full">
                {rowLabelsForDisplay.map((label) => (
                  <span key={`left-${label}`} className="text-xs font-medium text-muted-foreground flex-1 w-6 flex items-center justify-center">
                    {label}
                  </span>
                ))}
              </div>
              <GameBoard
                board={gameState.board}
                pieces={gameState.pieces}
                selectedPieceId={gameState.selectedPieceId}
                validMoves={gameState.validMoves}
                onSquareClick={handleSquareClick}
                currentPlayer={gameState.currentPlayer}
                isGameOver={gameState.isGameOver}
                getAnimalChar={getAnimalChar}
                boardCols={BOARD_COLS}
                boardRows={BOARD_ROWS}
              />
              <div className="flex flex-col justify-around items-center h-full">
                {rowLabelsForDisplay.map((label) => (
                  <span key={`right-${label}`} className="text-xs font-medium text-muted-foreground flex-1 w-6 flex items-center justify-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="w-6 h-6"></div>
              <div className="flex justify-around items-center w-full">
                {colLabels.map((label) => (
                  <span key={`bottom-${label}`} className="text-xs font-medium text-muted-foreground flex-1 text-center h-6 flex items-center justify-center">
                    {label}
                  </span>
                ))}
              </div>
              <div className="w-6 h-6"></div>
            </div>
          </div>

           <div className="mt-4 text-center lg:text-left w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto">
            <p className={`text-lg font-medium p-3 rounded-md shadow ${gameState.isGameOver ? (gameState.winner === 'human' ? 'bg-green-600 text-white' : (gameState.winner === 'ai' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black') ) : 'bg-card text-card-foreground'}`}>
              {gameState.message}
            </p>
          </div>
        </section>

        <aside className="w-full lg:w-80 xl:w-96 flex flex-col gap-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-primary">
                <BarChart2 size={28}/> Spielstatus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-base">
              <div className="flex items-center justify-between">
                <span className="font-medium text-muted-foreground">Am Zug:</span>
                <span className={`font-semibold flex items-center gap-1 ${gameState.currentPlayer === 'human' ? 'text-primary' : 'text-accent'}`}>
                  {gameState.currentPlayer === 'human' ? <User size={18}/> : <Cpu size={18}/>}
                  {gameState.currentPlayer === 'human' ? gameState.playerTwoName : gameState.playerOneName}
                </span>
              </div>
               {gameState.lionMovedLastTurn && (
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Löwe Pausiert:</span>
                    <span className={`font-semibold ${gameState.lionMovedLastTurn === 'human' ? 'text-primary' : 'text-accent'}`}>
                        Löwe von {(gameState.lionMovedLastTurn === 'human' ? gameState.playerTwoName : gameState.playerOneName)} muss aussetzen.
                    </span>
                </div>
               )}
               {gameState.swampSkipTurnForPiece && gameState.swampSkipTurnForPiece.player === gameState.currentPlayer && gameState.pieces[gameState.swampSkipTurnForPiece.pieceId] && (
                 <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Sumpfpause:</span>
                    <span className={`font-semibold ${gameState.swampSkipTurnForPiece.player === 'human' ? 'text-primary' : 'text-accent'}`}>
                        {getAnimalChar(gameState.pieces[gameState.swampSkipTurnForPiece.pieceId].animal).toUpperCase()} von {gameState.swampSkipTurnForPiece.player === 'human' ? gameState.playerTwoName : gameState.playerOneName} ist pausiert.
                    </span>
                </div>
               )}
              {gameState.winner && (
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">Gewinner:</span>
                  <span className="font-semibold text-green-600 flex items-center gap-1">
                    <Award size={18} className="text-yellow-500" />
                    {gameState.winner === 'human' ? gameState.playerTwoName : (gameState.winner === 'ai' ? gameState.playerOneName : 'N/A')}
                  </span>
                </div>
              )}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Gefangen von {gameState.playerTwoName} (Dir):</h4>
                <ul className="list-disc list-inside text-xs text-muted-foreground">
                  <li>Gazellen: {gameState.humanCapturedAIScore.gazelle} / 5</li>
                  <li>Giraffen: {gameState.humanCapturedAIScore.giraffe} / 2</li>
                  <li>Löwen: {gameState.humanCapturedAIScore.lion} / 1</li>
                </ul>
              </div>
               <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Gefangen von {gameState.playerOneName} (KI):</h4>
                <ul className="list-disc list-inside text-xs text-muted-foreground">
                  <li>Gazellen: {gameState.aiCapturedHumanScore.gazelle} / 5</li>
                  <li>Giraffen: {gameState.aiCapturedHumanScore.giraffe} / 2</li>
                  <li>Löwen: {gameState.aiCapturedHumanScore.lion} / 1</li>
                </ul>
              </div>
              <Button onClick={handleResetGame} className="w-full" variant="outline" size="sm">Spiel zurücksetzen & Tutorial anzeigen</Button>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-primary">
                <Lightbulb size={28}/> KI-Unterstützung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleAiAnalyze} disabled={isLoadingAI || gameState.isGameOver} className="w-full" size="sm">
                {isLoadingAI ? 'KI beschäftigt...' : 'Spiel analysieren'}
              </Button>
              <Button
                onClick={handleAiSuggest}
                disabled={isLoadingAI || gameState.isGameOver}
                className="w-full"
                size="sm"
              >
                {isLoadingAI ? 'KI beschäftigt...' : 'KI-Zugvorschlag erhalten'}
              </Button>
              {isLoadingAI && <p className="text-sm text-muted-foreground text-center">KI denkt nach...</p>}
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-primary">
                <Info size={24}/> Legende: Terrain & Figuren
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <h5 className="font-medium text-muted-foreground mb-1">Terrain:</h5>
              {terrainLegendItems.map((item, index) => (
                <div key={`terrain-${index}`} className="flex items-center gap-2 py-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-muted/20 p-1 border border-muted/40">
                    <TerrainLegendIcon terrain={item.terrain} riftDirection={item.riftDir} size={18} />
                  </span>
                  <span className="text-muted-foreground">{item.description}</span>
                </div>
              ))}
              <h5 className="font-medium text-muted-foreground mt-3 mb-1">Figuren:</h5>
              {pieceLegendItems.map((item, index) => (
                 <div key={`piece-${index}`} className="flex flex-col items-start gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <PieceLegendIcon char={item.char} playerType={item.playerType} />
                      <span className="text-muted-foreground font-semibold">{item.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/80 ml-8 pl-1">{item.rule}</p>
                  </div>
              ))}
            </CardContent>
          </Card>

        </aside>
      </main>
    </div>
  );
}
