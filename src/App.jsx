function App() {
  const readings = [
    { title: "In Solidarity with Library Genesis and Sci-Hub", url: "https://custodians.online/" },
    { title: "Sticks — George Saunders", url: "https://www.unm.edu/~gmartin/535/Sticks.htm" },
  ];

  const styles = {
    page: {
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      color: '#1a1a1a',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    },
    main: {
      maxWidth: '42rem',
      margin: '0 auto',
      padding: '4rem 1.5rem',
    },
    name: {
      fontSize: '2.25rem',
      fontWeight: 600,
      color: '#000000',
      letterSpacing: '-0.02em',
      marginBottom: '1.5rem',
    },
    bio: {
      color: '#444444',
      lineHeight: 1.7,
      fontSize: '15px',
    },
    bioP: {
      marginBottom: '1rem',
    },
    link: {
      color: '#1a1a1a',
      textDecoration: 'underline',
      textDecorationColor: '#cccccc',
      textUnderlineOffset: '2px',
    },
    linksRow: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '0.5rem',
      marginTop: '1.5rem',
      fontSize: '14px',
      color: '#666666',
    },
    dot: {
      color: '#cccccc',
      margin: '0 0.25rem',
    },
    socialLink: {
      color: '#666666',
      textDecoration: 'none',
    },
    sectionHeader: {
      fontSize: '1.125rem',
      fontWeight: 500,
      color: '#000000',
      marginBottom: '1rem',
      marginTop: '3rem',
    },
    readingLink: {
      color: '#666666',
      textDecoration: 'underline',
      textDecorationColor: '#dddddd',
      textUnderlineOffset: '2px',
      fontSize: '15px',
      display: 'block',
      marginBottom: '0.5rem',
    },
  };

  return (
    <div style={styles.page}>
      <main style={styles.main}>
        <header>
          <h1 style={styles.name}>Nathan Delisle</h1>
          <div style={styles.bio}>
            <p style={styles.bioP}>
              I am a senior at the University of Chicago studying Computer Science and Statistics.
            </p>
            <p style={styles.bioP}>
              I am currently in the{' '}
              <a href="https://chicagohai.github.io/" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Chicago Human+AI Lab
              </a>
              . Previously, I was in the{' '}
              <a href="https://lucian.uchicago.edu/blogs/phonlab/" target="_blank" rel="noopener noreferrer" style={styles.link}>
                Phonology Laboratory
              </a>
              .
            </p>
            <p style={styles.bioP}>
              In Summer 2025, I was a{' '}
              <a href="https://www.matsprogram.org/" target="_blank" rel="noopener noreferrer" style={styles.link}>
                MATS 8.0
              </a>
              {' '}scholar under Steven Adler and Girish Sastry. This summer, I am at Evercore building LLM evaluations for investment banking.
            </p>
          </div>
          <div style={styles.linksRow}>
            <a href="mailto:ndelisle@uchicago.edu" style={styles.socialLink}>Email</a>
            <span style={styles.dot}>·</span>
            <a href="https://x.com/delisl3" target="_blank" rel="noopener noreferrer" style={styles.socialLink}>X</a>
            <span style={styles.dot}>·</span>
            <a href="https://github.com/nathandelisle" target="_blank" rel="noopener noreferrer" style={styles.socialLink}>GitHub</a>
            <span style={styles.dot}>·</span>
            <a href="https://www.lesswrong.com/users/nathan-delisle" target="_blank" rel="noopener noreferrer" style={styles.socialLink}>LessWrong</a>
          </div>
        </header>
        <section>
          <h2 style={styles.sectionHeader}>Readings</h2>
          <div>
            {readings.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={styles.readingLink}>{item.title}</a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
