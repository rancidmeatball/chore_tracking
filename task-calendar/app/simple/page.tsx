export default function SimplePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Simple Page Works!</h1>
      <p>If you can see this, Next.js routing is working correctly.</p>
      <p>Time: {new Date().toISOString()}</p>
    </div>
  )
}
