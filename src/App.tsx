import { useState } from 'react';
import Home from './components/Home';
import QuestionSession from './components/QuestionSession';
import ResultView from './components/ResultView';
import { Question, Answer, SessionSettings } from './types';
import { calculateSummary } from './services/resultCalculator';

type AppView = 'home' | 'session' | 'result';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const handleStartSession = (sessionQuestions: Question[], sessionSettings: SessionSettings) => {
    setQuestions(sessionQuestions);
    setSettings(sessionSettings);
    setCurrentView('session');
  };

  const handleSessionComplete = (sessionAnswers: Answer[], quitAtQuestion?: number) => {
    setAnswers(sessionAnswers);
    // 途中終了した場合、settingsに記録
    if (quitAtQuestion !== undefined && settings) {
      setSettings({
        ...settings,
        quitAtQuestion,
      });
    }
    setCurrentView('result');
  };

  const handleBackToHome = () => {
    setCurrentView('home');
    setQuestions([]);
    setSettings(null);
    setAnswers([]);
  };

  if (currentView === 'session' && settings) {
    return (
      <QuestionSession
        questions={questions}
        settings={settings}
        onComplete={handleSessionComplete}
      />
    );
  }

  if (currentView === 'result' && settings) {
    const summary = calculateSummary(answers, questions.length, settings);
    return (
      <ResultView
        answers={answers}
        questions={questions}
        summary={summary}
        mode={settings.mode}
        onBack={handleBackToHome}
        quitAtQuestion={settings.quitAtQuestion}
      />
    );
  }

  return <Home onStartSession={handleStartSession} />;
}

export default App;
