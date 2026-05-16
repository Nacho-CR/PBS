// From indexedDB.html
//    <script src="app.js"></script>
// lands here

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function generateRoundRobinMatches(teams) {
  const matches = [];
  const teamIds = [...teams.map(t => t.id)];
  
  if (teamIds.length % 2 !== 0) {
    teamIds.push('BYE');
  }

  const numTeams = teamIds.length;
  const numRounds = numTeams - 1;
  const half = numTeams / 2;

  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < half; i++) {
      const teamA = teamIds[i];
      const teamB = teamIds[numTeams - 1 - i];

      if (teamA !== 'BYE' && teamB !== 'BYE') {
        matches.push({
          id: `match-${round}-${i}-${crypto.randomUUID().slice(0, 4)}`,
          teamAId: teamA,
          teamBId: teamB,
          status: 'pending',
          round,
        });
      }
    }
    // Rotate teamIds for next round (keep first team fixed)
    teamIds.splice(1, 0, teamIds.pop());
  }

  return matches;
}

function generateEliminationMatches(teams) {
  const matches = [];
  const teamIds = [...teams.map(t => t.id)];
  const numTeams = teamIds.length;
  
  // Power of 2 logic
  const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(numTeams)));
  const byesNeeded = nextPowerOfTwo - numTeams;
  
  // Fill with byes
  for (let i = 0; i < byesNeeded; i++) {
    teamIds.push('BYE');
  }

  // Bracket seeding (simple order)
  const round1Matches = nextPowerOfTwo / 2;
  for (let i = 0; i < round1Matches; i++) {
    const teamA = teamIds[i * 2];
    const teamB = teamIds[i * 2 + 1];
    
    matches.push({
      id: `elim-r1-m${i}`,
      teamAId: teamA,
      teamBId: teamB,
      status: (teamA === 'BYE' || teamB === 'BYE') ? 'completed' : 'pending',
      round: 1,
      scoreA: teamB === 'BYE' ? 1 : undefined,
      scoreB: teamA === 'BYE' ? 1 : undefined,
    });
  }

  // Generate placeholder matches for future rounds
  let currentRoundMatches = round1Matches;
  let totalRounds = Math.log2(nextPowerOfTwo);
  for (let r = 2; r <= totalRounds; r++) {
    currentRoundMatches /= 2;
    for (let i = 0; i < currentRoundMatches; i++) {
      matches.push({
        id: `elim-r${r}-m${i}`,
        teamAId: 'TBD',
        teamBId: 'TBD',
        status: 'pending',
        round: r,
      });
    }
  }

  return matches;
}

function getNextMatchIdInBracket(matchId) {
  const parts = matchId.split('-');
  if (parts[0] !== 'elim') return null;
  
  const round = parseInt(parts[1].replace('r', ''));
  const idx = parseInt(parts[2].replace('m', ''));
  
  const nextRound = round + 1;
  const nextIdx = Math.floor(idx / 2);
  
  return `elim-r${nextRound}-m${nextIdx}`;
}

function calculateStandings(teams, matches) {
  const filteredMatches = matches.filter(m => m.teamAId !== 'BYE' && m.teamBId !== 'BYE' && m.teamAId !== 'TBD' && m.teamBId !== 'TBD');

  const standings = teams.map(team => {
    const teamMatches = filteredMatches.filter(m => m.status === 'completed' && (m.teamAId === team.id || m.teamBId === team.id));
    let won = 0;
    let pf = 0;
    let pa = 0;

    teamMatches.forEach(m => {
      const isTeamA = m.teamAId === team.id;
      const myScore = isTeamA ? (m.scoreA || 0) : (m.scoreB || 0);
      const oppScore = isTeamA ? (m.scoreB || 0) : (m.scoreA || 0);
      
      if (myScore > oppScore) won++;
      pf += myScore;
      pa += oppScore;
    });

    return {
      teamId: team.id,
      teamName: team.name,
      played: teamMatches.length,
      won,
      lost: teamMatches.length - won,
      pf,
      pa,
      diff: pf - pa,
      winPct: teamMatches.length > 0 ? (won / teamMatches.length) * 100 : 0
    };
  });

  return standings.sort((a, b) => b.won - a.won || b.diff - a.diff || b.pf - a.pf);
}

// Simple Icon Helpers
const Icons = {
  Trophy: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 22V18"/><path d="M14 22V18"/><path d="M18 4H6v7a6 6 0 0 0 12 0V4Z"/></svg>',
  Trash2: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
  CheckCircle2: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>'
};

class App {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.state = {
      currentStep: 'setup',
      tournament: null,
      // Setup Form State
      name: 'Weekend Picklers',
      type: 'team',
      format: 'round-robin',
      players: [],
      teams: [],
      newPlayerName: '',
      newTeamName: ''
    };

    this.init();
  }

  init() {
    this.loadFromLocalStorage();
    this.render();
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.saveToLocalStorage();
    this.render();
  }

  loadFromLocalStorage() {
    const saved = localStorage.getItem('pickleball_tournament');
    if (saved) {
      const data = JSON.parse(saved);
      if (data && data.matches) {
        this.state.tournament = data;
        this.state.currentStep = data.status === 'setup' ? 'setup' : 'active';
      }
    }
  }

  saveToLocalStorage() {
    if (this.state.tournament) {
      localStorage.setItem('pickleball_tournament', JSON.stringify(this.state.tournament));
    }
  }

  // Actions
  addPlayer() {
    const rawValue = this.state.newPlayerName;
    if (!rawValue.trim()) return;

    // Split by comma or new line
    const names = rawValue.split(/,|\n/).map(n => n.trim()).filter(n => n.length > 0);
    
    const newPlayers = names.map(name => ({
      id: crypto.randomUUID(),
      name
    }));

    this.setState({
      players: [...this.state.players, ...newPlayers],
      newPlayerName: ''
    });
  }

  removePlayer(id) {
    this.setState({
      players: this.state.players.filter(p => p.id !== id)
    });
  }

  addTeam() {
    const rawValue = this.state.newTeamName;
    if (!rawValue.trim()) return;

    // Split by comma or new line
    const names = rawValue.split(/,|\n/).map(n => n.trim()).filter(n => n.length > 0);
    
    const newTeams = names.map(name => ({
      id: crypto.randomUUID(),
      name,
      playerIds: []
    }));

    this.setState({
      teams: [...this.state.teams, ...newTeams],
      newTeamName: ''
    });
  }

  removeTeam(id) {
    this.setState({
      teams: this.state.teams.filter(t => t.id !== id)
    });
  }

  startTournament() {
    let finalTeams = [...this.state.teams];
    const { type, players, format, name } = this.state;

    if (type === 'rotating') {
      finalTeams = players.map(p => ({
        id: p.id,
        name: p.name,
        playerIds: [p.id]
      }));
    }

    if (finalTeams.length < 2) {
      alert("Please add at least 2 teams/players");
      return;
    }

    let matches = [];
    if (format === 'round-robin') {
      matches = generateRoundRobinMatches(finalTeams);
    } else if (format === 'elimination') {
      matches = generateEliminationMatches(finalTeams);
    } else {
      matches = generateRoundRobinMatches(finalTeams);
    }

    const tournament = {
      id: crypto.randomUUID(),
      name,
      type,
      format,
      teams: finalTeams,
      players: this.state.players,
      matches,
      status: 'active',
      createdAt: Date.now()
    };

    this.setState({
      tournament,
      currentStep: 'active'
    });
  }

  updateScore(matchId, scoreA, scoreB) {
    if (!this.state.tournament) return;
    
    let updatedMatches = this.state.tournament.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, scoreA, scoreB, status: 'completed' };
      }
      return m;
    });

    if (this.state.tournament.format === 'elimination') {
      const match = updatedMatches.find(m => m.id === matchId);
      if (match && match.status === 'completed') {
        const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
        const nextMatchId = getNextMatchIdInBracket(matchId);
        
        if (nextMatchId && winnerId !== 'BYE' && winnerId !== 'TBD') {
          updatedMatches = updatedMatches.map(m => {
            if (m.id === nextMatchId) {
              const parts = matchId.split('-');
              const idx = parseInt(parts[2].replace('m', ''));
              if (idx % 2 === 0) {
                return { ...m, teamAId: winnerId };
              } else {
                return { ...m, teamBId: winnerId };
              }
            }
            return m;
          });
        }
      }
    }

    this.setState({
      tournament: { ...this.state.tournament, matches: updatedMatches }
    });
  }

  resetTournament() {
    if (confirm("Reset everything? Current progress will be lost.")) {
      localStorage.removeItem('pickleball_tournament');
      this.state = {
        currentStep: 'setup',
        tournament: null,
        name: 'Weekend Picklers',
        type: 'team',
        format: 'round-robin',
        players: [],
        teams: [],
        newPlayerName: '',
        newTeamName: ''
      };
      this.render();
    }
  }

  // Rendering
  render() {
    const { currentStep, tournament } = this.state;
    
    this.container.innerHTML = `
      <div class="app-container">
        ${this.renderHeader()}
        <main class="main-content">
          ${currentStep === 'setup' ? this.renderSetup() : this.renderDashboard()}
        </main>
      </div>
    `;

    this.attachEventListeners();
  }

  renderHeader() {
    const name = this.state.tournament ? this.state.tournament.name : "PICKLEPRO TOURNEY";
    return `
      <header class="header">
        <div class="header-logo">
          <div class="logo-icon">
            ${Icons.Trophy}
          </div>
          <h1 class="logo-text">
            ${name}
          </h1>
        </div>
        ${this.state.tournament ? `
          <button id="reset-btn" class="btn btn-text">
            RESET TOURNAMENT
          </button>
        ` : `
          <div class="header-status hidden sm-block">
            Pro Scoring System v1.0
          </div>
        `}
      </header>
    `;
  }

  renderSetup() {
    const { type, format, name, teams, players, newTeamName, newPlayerName } = this.state;
    const isTeam = type === 'team';
    
    return `
      <div class="setup-grid">
        <!-- Configuration Panel -->
        <section class="panel">
          <div class="panel-header">
            Setup & Configuration
          </div>
          <div class="panel-body">
            <div class="form-group-list">
              <div class="form-group">
                <label class="label">Tournament Name</label>
                <input type="text" id="tourney-name" value="${name}" class="input" placeholder="e.g. Summer Open Match">
              </div>

              <div class="form-group">
                <label class="label">Type</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="type" value="team" ${type === 'team' ? 'checked' : ''}>
                    <span class="radio-text">Team Based</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="type" value="rotating" ${type === 'rotating' ? 'checked' : ''}>
                    <span class="radio-text">Rotating Partners</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="label">Format</label>
                <div class="radio-group">
                  <label class="radio-label">
                    <input type="radio" name="format" value="round-robin" ${format === 'round-robin' ? 'checked' : ''}>
                    <span class="radio-text">Round Robin</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="format" value="ladder" ${format === 'ladder' ? 'checked' : ''}>
                    <span class="radio-text">Ladders</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" name="format" value="elimination" ${format === 'elimination' ? 'checked' : ''}>
                    <span class="radio-text">Single Elimination</span>
                  </label>
                </div>
              </div>
            </div>

            <div style="margin-top: auto; padding-top: 1.5rem; border-top: 1px solid var(--border);">
              <button id="start-btn" ${((isTeam && teams.length < 2) || (!isTeam && players.length < 2)) ? 'disabled' : ''} class="btn btn-primary">
                Start Tournament
              </button>
            </div>
          </div>
        </section>

        <!-- Registration Panel -->
        <section class="panel">
          <div class="panel-header">
            ${isTeam ? 'Register Teams' : 'Register Players'}
          </div>
          <div class="panel-body" style="display: flex; flex-direction: column;">
            <div class="form-group" style="margin-bottom: 1.5rem;">
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label class="label" style="font-size: 0.75rem; color: var(--text-sub);">Enter names separated by commas or new lines</label>
                <textarea id="new-item-name" class="input" style="flex: 1; min-height: 80px; resize: vertical;" placeholder="${isTeam ? 'e.g. Team Alpha, Team Beta\nTeam Gamma' : 'e.g. John Doe, Jane Smith\nBob Wilson'}">${isTeam ? newTeamName : newPlayerName}</textarea>
                <button id="add-item-btn" class="btn btn-secondary">Add List</button>
              </div>
            </div>

            <div style="flex-grow: 1; overflow-y: auto; min-height: 200px;">
              <div class="item-list">
                ${(isTeam ? teams : players).map(item => `
                  <div class="list-item">
                    <span class="list-item-text">${item.name}</span>
                    <button class="remove-item-btn remove-btn" data-id="${item.id}">
                      ${Icons.Trash2}
                    </button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  renderDashboard() {
    const { tournament } = this.state;
    const standings = calculateStandings(tournament.teams, tournament.matches);
    
    return `
      <div class="dashboard-grid">
        ${this.renderStandings(standings)}
        ${this.renderSchedule()}
        ${this.renderStats(standings)}
      </div>
    `;
  }

  renderStandings(standings) {
    return `
      <section class="panel" style="order: 2;">
        <div class="panel-header">
          Current Standings
        </div>
        <div class="panel-body" style="padding: 0;">
          <table class="standings-table">
            <thead>
              <tr>
                <th>RK</th>
                <th>Team</th>
                <th class="text-right">W-L</th>
                <th class="text-right">+/-</th>
              </tr>
            </thead>
            <tbody>
              ${standings.map((row, idx) => `
                <tr>
                  <td class="rank-cell">${idx + 1}</td>
                  <td class="team-cell">${row.teamName}</td>
                  <td class="text-right" style="color: var(--text-sub); font-weight: 500;">${row.won}-${row.lost}</td>
                  <td class="text-right">
                    <span class="diff-badge">
                      ${row.diff > 0 ? '+' : ''}${row.diff}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  renderSchedule() {
    const { tournament } = this.state;
    const completedCount = tournament.matches.filter(m => m.status === 'completed').length;
    
    return `
      <section class="panel" style="order: 1; flex-grow: 1;">
        <div class="panel-header">
          <span>Match Schedule</span>
          <span style="font-weight: 500; opacity: 0.8;">
            ${completedCount} / ${tournament.matches.length} Finished
          </span>
        </div>
        <div class="panel-body">
          <div class="match-grid">
            ${tournament.matches
              .filter(m => m.teamAId !== 'BYE' && m.teamBId !== 'BYE')
              .map(match => {
                const teamA = tournament.teams.find(t => t.id === match.teamAId) || { name: match.teamAId === 'TBD' ? 'To Be Determined' : match.teamAId };
                const teamB = tournament.teams.find(t => t.id === match.teamBId) || { name: match.teamBId === 'TBD' ? 'To Be Determined' : match.teamBId };
                const isTBD = match.teamAId === 'TBD' || match.teamBId === 'TBD';
                const isLive = !isTBD && match.status !== 'completed';
                
                return `
                  <div class="match-card ${match.status === 'completed' ? 'completed' : (isTBD ? 'tbd' : '')}">
                    <div class="match-card-header">
                      <span class="match-round-label">
                        ${tournament.format === 'elimination' ? (match.round === 3 ? 'Final' : match.round === 2 ? 'Semi-Final' : `Round ${match.round}`) : `Match ${match.round}`}
                      </span>
                      ${isLive ? '<span class="live-indicator">LIVE</span>' : ''}
                      ${match.status === 'completed' ? `<span class="text-success">${Icons.CheckCircle2}</span>` : ''}
                    </div>

                    <div class="match-teams">
                      <div class="match-team">
                        <span class="team-name ${match.status === 'completed' && (match.scoreA || 0) > (match.scoreB || 0) ? 'winner' : ''}">
                          ${teamA.name}
                        </span>
                        ${!isTBD ? `<input type="number" data-match-id="${match.id}" data-team="A" value="${match.scoreA !== undefined ? match.scoreA : ''}" class="score-input">` : ''}
                      </div>
                      <div class="match-team">
                        <span class="team-name ${match.status === 'completed' && (match.scoreB || 0) > (match.scoreA || 0) ? 'winner' : ''}">
                          ${teamB.name}
                        </span>
                        ${!isTBD ? `<input type="number" data-match-id="${match.id}" data-team="B" value="${match.scoreB !== undefined ? match.scoreB : ''}" class="score-input">` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  renderStats(standings) {
    const { tournament } = this.state;
    const completed = tournament.matches.filter(m => m.status === 'completed');
    const totalPoints = tournament.matches.reduce((acc, m) => acc + (m.scoreA || 0) + (m.scoreB || 0), 0);
    const avgPts = completed.length ? (totalPoints / completed.length).toFixed(1) : '0';
    
    return `
      <section class="panel" style="order: 3;">
        <div class="panel-header">
          Tournament Stats
        </div>
        <div class="panel-body">
          <div class="stats-grid">
            <div class="stat-tile">
              <div class="stat-value">${completed.length}</div>
              <div class="stat-label">Games Played</div>
            </div>
            <div class="stat-tile">
              <div class="stat-value">${avgPts}</div>
              <div class="stat-label">Avg Pts/GM</div>
            </div>
          </div>

          <div class="insights-section">
            <div class="panel-header" style="background: transparent; border: none; padding: 0; margin-bottom: 0.75rem;">Live Insights</div>
            <div class="insights-list">
              <div class="insight-item">
                <span class="insight-label">Total Points</span>
                <span class="insight-value">${totalPoints}</span>
              </div>
              <div class="insight-item">
                <span class="insight-label">Current Leader</span>
                <span class="insight-value text-accent">${standings[0]?.teamName || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  attachEventListeners() {
    // Setup listeners
    if (this.state.currentStep === 'setup') {
      const nameInput = document.getElementById('tourney-name');
      if (nameInput) {
        nameInput.onchange = (e) => this.setState({ name: e.target.value });
      }

      document.querySelectorAll('input[name="type"]').forEach(radio => {
        radio.onchange = (e) => this.setState({ type: e.target.value });
      });

      document.querySelectorAll('input[name="format"]').forEach(radio => {
        radio.onchange = (e) => this.setState({ format: e.target.value });
      });

      const startBtn = document.getElementById('start-btn');
      if (startBtn) {
        startBtn.onclick = () => this.startTournament();
      }

      const newItemInput = document.getElementById('new-item-name');
      if (newItemInput) {
        newItemInput.oninput = (e) => {
          if (this.state.type === 'team') {
            this.state.newTeamName = e.target.value;
          } else {
            this.state.newPlayerName = e.target.value;
          }
        };
      }

      const addItemBtn = document.getElementById('add-item-btn');
      if (addItemBtn) {
        addItemBtn.onclick = () => {
          this.state.type === 'team' ? this.addTeam() : this.addPlayer();
        };
      }

      document.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          this.state.type === 'team' ? this.removeTeam(id) : this.removePlayer(id);
        };
      });
    } else {
      // Active listeners
      const resetBtn = document.getElementById('reset-btn');
      if (resetBtn) {
        resetBtn.onclick = () => this.resetTournament();
      }

      document.querySelectorAll('.score-input').forEach(input => {
        input.onblur = (e) => {
          const matchId = input.getAttribute('data-match-id');
          const team = input.getAttribute('data-team');
          const val = parseInt(e.target.value);
          if (!isNaN(val)) {
            const match = this.state.tournament.matches.find(m => m.id === matchId);
            const scoreA = team === 'A' ? val : (match.scoreA || 0);
            const scoreB = team === 'B' ? val : (match.scoreB || 0);
            this.updateScore(matchId, scoreA, scoreB);
          }
        };
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App('app');
});

if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('service worker registered', reg))
    .catch(err => console.log('service worker not registered', err));
}

// Also from index.html and after app.js we got
//    <script src="script.js"></script>

// document.addEventListener('DOMContentLoaded', function() {
//   // nav menu
//   const menus = document.querySelectorAll('.side-menu');
//   M.Sidenav.init(menus, {edge: 'right'});
//   // add recipe form
//   const forms = document.querySelectorAll('.side-form');
//   M.Sidenav.init(forms, {edge: 'left'});
// });