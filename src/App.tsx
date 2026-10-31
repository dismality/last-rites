// App routes between screens: ContentWarning → Loading → Title → Game → Ending
// Screen state is driven by useGameStore; this component just renders the active screen.
// Screens are added as specs are completed; for now it renders a placeholder.

export default function App() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#14110f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#d8c9a3',
        fontFamily: 'serif',
        fontSize: '1.5rem',
      }}
    >
      Last Rites — foundation scaffold
    </div>
  )
}
