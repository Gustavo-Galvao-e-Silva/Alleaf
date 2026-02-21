export default function ExerciseList({ exercises }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {exercises.map((ex, i) => (
        <div key={i} className="p-4 border rounded-xl bg-white shadow-sm">
          <span className="text-xs uppercase font-bold text-blue-500">{ex.type}</span>
          <h3 className="text-lg font-semibold mt-1">{ex.title}</h3>
          <p className="text-gray-600 mt-2 text-sm">{ex.content}</p>
          <button className="mt-4 w-full bg-gray-100 py-2 rounded-lg hover:bg-gray-200">
            Start Exercise
          </button>
        </div>
      ))}
    </div>
  );
}
