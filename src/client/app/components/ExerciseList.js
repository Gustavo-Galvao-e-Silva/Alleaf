export default function ExerciseList({ exercises }) {
  const [activeScript, setActiveScript] = useState(null);

  if (activeScript) {
    return <GuidedExercise script={activeScript} onExit={() => setActiveScript(null)} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {exercises.map((ex, i) => (
        <div key={i} className="...">
          {/* ... existing content ... */}
          <button
            onClick={() => ex.type === 'interactive' ? setActiveScript(ex.content) : handleAsync(ex)}
            className="bg-blue-500 text-white ..."
          >
            {ex.type === 'interactive' ? "Start Guided Session" : "Read Instructions"}
          </button>
        </div>
      ))}
    </div>
  );
}
