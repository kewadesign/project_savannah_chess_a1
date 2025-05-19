
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Sparkles, Shield, TrendingUp, Mountain, Waves, Wind, SkipForward, HelpCircle, ArrowUp } from 'lucide-react';

interface TutorialProps {
  onStartGame: () => void;
}

const tutorialSteps = [
  {
    icon: <Sparkles className="inline-block mr-2 text-yellow-500" />,
    title: 'Willkommen bei Savannah Chase!',
    content: 'Dein Ziel: Fange den gegnerischen Löwen ODER alle 5 gegnerischen Gazellen. Du spielst mit den weißen Figuren unten.',
  },
  {
    icon: <Shield className="inline-block mr-2 text-red-500" />,
    title: 'Der Löwe (L)',
    content: 'Der Löwe ist dein König! Er zieht 1 Feld in jede Richtung (gerade oder diagonal). Nach einem Zug muss er eine Runde aussetzen.',
  },
  {
    icon: <TrendingUp className="inline-block mr-2 text-blue-500" />,
    title: 'Die Giraffe (G)',
    content: 'Die Giraffe zieht max. 2 Felder (H/V). Kann Sumpf (S) nicht betreten und auch nicht darüber springen, wenn es das Zwischenfeld eines 2-Felder-Zugs ist. KANN Hügel (H) betreten (andere nicht!). Kann eine Kluft (K) bei einem 2-Felder-Zug nicht überspringen, wenn das Zwischenfeld eine Kluft ist.',
  },
  {
    icon: <Sparkles className="inline-block mr-2 text-green-500" />,
    title: 'Die Gazelle (Z)',
    content: 'Die Gazelle zieht 1 Feld gerade vorwärts. Zum Schlagen springt sie 1 Feld diagonal vorwärts. Gazellen können gegnerische Gazellen schlagen, aber keine Löwen oder Giraffen.',
  },
  {
    icon: <Mountain className="inline-block mr-2 text-yellow-700" />,
    title: 'Spezialfeld: Hügel (H)',
    content: 'Hügel (H) können NUR von Giraffen betreten werden. Für andere Figuren sind sie blockiert.',
  },
  {
    icon: <Waves className="inline-block mr-2 text-emerald-600" />,
    title: 'Spezialfeld: Sumpf (S)',
    content: 'Betritt ein Löwe oder eine Gazelle einen Sumpf (S), müssen sie in ihrem nächsten Zug aussetzen. Giraffen dürfen Sümpfe gar nicht erst betreten und auch nicht darüber springen.',
  },
  {
    icon: <Wind className="inline-block mr-2 text-destructive" />,
    title: 'Spezialfeld: Kluft (K)',
    content: 'Klüfte (K) sind knifflig! Landest du auf einer, wirst du in die angezeigte Pfeilrichtung weitergeschoben, bis du auf ein Hindernis triffst. Giraffen können sie nicht einfach überspringen.',
  },
  {
    icon: <Sparkles className="inline-block mr-2" />,
    title: 'Los geht\'s!',
    content: 'Das waren die Regeln. Klicke auf "Spiel starten", um loszulegen. Viel Glück!',
  },
];

const Tutorial: React.FC<TutorialProps> = ({ onStartGame }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tutorialSteps[currentStep];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 sm:p-8">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl text-primary flex items-center">
            {step.icon}
            {step.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-base sm:text-lg text-card-foreground">
          <p>{step.content}</p>
        </CardContent>
        <CardFooter className="flex justify-between items-center pt-4 gap-3">
          <Button onClick={handlePrev} disabled={currentStep === 0} variant="outline">
            <ChevronLeft className="mr-1 h-5 w-5" /> Zurück
          </Button>
          {currentStep < tutorialSteps.length - 1 ? (
            <>
              <Button onClick={onStartGame} variant="secondary">
                <SkipForward className="mr-1 h-5 w-5" /> Überspringen
              </Button>
              <Button onClick={handleNext}>
                Weiter <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </>
          ) : (
            <Button onClick={onStartGame} className="bg-green-600 hover:bg-green-700 text-white w-full">
              Spiel starten!
            </Button>
          )}
        </CardFooter>
      </Card>
       <div className="mt-4 text-sm text-muted-foreground">
        Schritt {currentStep + 1} von {tutorialSteps.length}
      </div>
    </div>
  );
};

export default Tutorial;

    