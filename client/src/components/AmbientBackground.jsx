export default function AmbientBackground({ subtle = false }) {
  return (
    <div className={`otion-ambient ${subtle ? 'otion-ambient-subtle' : ''}`} aria-hidden="true">
      <span className="otion-orb otion-orb-cyan" />
      <span className="otion-orb otion-orb-violet" />
      <span className="otion-orb otion-orb-pink" />
    </div>
  );
}
