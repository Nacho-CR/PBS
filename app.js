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
      name: 'Pickle Score',
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
    const name = this.state.newPlayerName.trim();
    if (!name) return;
    const player = { id: crypto.randomUUID(), name };
    this.setState({
      players: [...this.state.players, player],
      newPlayerName: ''
    });
  }

  removePlayer(id) {
    this.setState({
      players: this.state.players.filter(p => p.id !== id)
    });
  }

  addTeam() {
    const name = this.state.newTeamName.trim();
    if (!name) return;
    const team = { id: crypto.randomUUID(), name, playerIds: [] };
    this.setState({
      teams: [...this.state.teams, team],
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
      <div class="min-h-screen flex flex-col">
        ${this.renderHeader()}
        <main class="flex-grow p-6">
          ${currentStep === 'setup' ? this.renderSetup() : this.renderDashboard()}
        </main>
      </div>
    `;

    this.attachEventListeners();
  }

  renderHeader() {
    const name = this.state.tournament ? this.state.tournament.name : "Pickle Score";
    return `
      <header class="px-8 py-4 bg-white border-b border-border-subtle flex justify-between items-center shrink-0">
        <div class="flex items-center gap-3">
          <div class="text-accent">
            ${Icons.Trophy}
          </div>
          <h1 class="text-xl font-bold tracking-tight text-accent uppercase">
            ${name}
          </h1>
        </div>
        ${this.state.tournament ? `
          <button id="reset-btn" class="w-auto px-4 py-1.5 text-xs font-bold text-text-sub hover:text-rose-500 transition-colors bg-transparent border-0 cursor-pointer">
            RESET TOURNAMENT
          </button>
        ` : `
          <div class="text-xs text-text-sub font-medium uppercase tracking-widest hidden sm:block">
            Scoring App for Pickleball Tournaments
          </div>
        `}
      </header>
    `;
  }

  renderSetup() {
    const { type, format, name, teams, players, newTeamName, newPlayerName } = this.state;
    const isTeam = type === 'team';
    
    return `
      <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
        <!-- Configuration Panel -->
        <section class="bg-white border border-border-subtle rounded-[12px] flex flex-col overflow-hidden shadow-sm">
          <div class="px-4 py-3 bg-[#FAFAFA] border-b border-border-subtle text-[0.75rem] font-bold text-text-sub uppercase tracking-wider">
            Setup & Configuration
          </div>
          <div class="p-6 space-y-6 flex-grow overflow-y-auto">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-semibold text-text-main mb-2">Tournament Name</label>
                <input type="text" id="tourney-name" value="${name}" class="w-full px-3 py-2 border border-border-subtle rounded-md text-sm outline-none focus:ring-1 focus:ring-accent" placeholder="e.g. Summer Open Match">
              </div>

              <div>
                <label class="block text-sm font-semibold text-text-main mb-2">Type</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="radio" name="type" value="team" ${type === 'team' ? 'checked' : ''} class="accent-accent">
                    <span class="font-medium ${type === 'team' ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}">Team Based</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="radio" name="type" value="rotating" ${type === 'rotating' ? 'checked' : ''} class="accent-accent">
                    <span class="font-medium ${type === 'rotating' ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}">Rotating Partners</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-sm font-semibold text-text-main mb-2">Format</label>
                <div class="space-y-2">
                  <label class="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="radio" name="format" value="round-robin" ${format === 'round-robin' ? 'checked' : ''} class="accent-accent">
                    <span class="font-medium ${format === 'round-robin' ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}">Round Robin</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="radio" name="format" value="ladder" ${format === 'ladder' ? 'checked' : ''} class="accent-accent">
                    <span class="font-medium ${format === 'ladder' ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}">Ladders</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm cursor-pointer group">
                    <input type="radio" name="format" value="elimination" ${format === 'elimination' ? 'checked' : ''} class="accent-accent">
                    <span class="font-medium ${format === 'elimination' ? 'text-accent' : 'text-text-sub group-hover:text-text-main'}">Single Elimination</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="pt-6 border-t border-border-subtle mt-auto">
              <button id="start-btn" ${((isTeam && teams.length < 2) || (!isTeam && players.length < 2)) ? 'disabled' : ''} class="w-full bg-accent text-white text-sm font-bold py-3 rounded-md hover:bg-opacity-90 disabled:bg-slate-200 disabled:text-text-sub transition-all uppercase tracking-wider cursor-pointer">
                Start Tournament
              </button>
            </div>
          </div>
        </section>

        <!-- Registration Panel -->
        <section class="bg-white border border-border-subtle rounded-[12px] flex flex-col overflow-hidden shadow-sm">
          <div class="px-4 py-3 bg-[#FAFAFA] border-b border-border-subtle text-[0.75rem] font-bold text-text-sub uppercase tracking-wider">
            ${isTeam ? 'Register Teams' : 'Register Players'}
          </div>
          <div class="p-6 flex flex-col h-full">
            <div class="space-y-4 mb-6">
              <div class="flex gap-2">
                <input type="text" id="new-item-name" value="${isTeam ? newTeamName : newPlayerName}" class="flex-1 px-3 py-2 border border-border-subtle rounded-md text-sm outline-none focus:ring-1 focus:ring-accent placeholder:text-text-sub" placeholder="${isTeam ? 'Team Name' : 'Player Name'}">
                <button id="add-item-btn" class="w-auto px-4 bg-text-main text-white rounded-md text-sm font-bold cursor-pointer">Add</button>
              </div>
            </div>

            <div class="flex-grow overflow-y-auto min-h-[200px]">
              <div class="space-y-2">
                ${(isTeam ? teams : players).map(item => `
                  <div class="flex items-center justify-between px-3 py-2 border border-border-subtle rounded-md group hover:bg-slate-50 transition-colors">
                    <span class="text-sm font-medium text-text-main">${item.name}</span>
                    <button class="remove-item-btn text-text-sub hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all font-bold cursor-pointer" data-id="${item.id}">
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
      <div class="lg:grid lg:grid-cols-[280px_1fr_300px] gap-6 h-full items-stretch flex flex-col lg:flex-row">
        ${this.renderStandings(standings)}
        ${this.renderSchedule()}
        ${this.renderStats(standings)}
      </div>
    `;
  }

  renderStandings(standings) {
    return `
      <section class="bg-white border border-border-subtle rounded-[12px] flex flex-col overflow-hidden shadow-sm order-2 lg:order-1">
        <div class="px-4 py-3 bg-[#FAFAFA] border-b border-border-subtle text-[0.75rem] font-bold text-text-sub uppercase tracking-wider">
          Current Standings
        </div>
        <div class="panel-content overflow-y-auto p-0">
          <table class="w-full text-xs text-left">
            <thead>
              <tr class="bg-slate-50/50">
                <th class="px-4 py-3 text-text-sub font-semibold border-b border-border-subtle uppercase">RK</th>
                <th class="px-4 py-3 text-text-sub font-semibold border-b border-border-subtle uppercase">Team</th>
                <th class="px-4 py-3 text-text-sub font-semibold border-b border-border-subtle uppercase text-right">W-L</th>
                <th class="px-4 py-3 text-text-sub font-semibold border-b border-border-subtle uppercase text-right">+/-</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              ${standings.map((row, idx) => `
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-4 py-3 font-bold text-accent">${idx + 1}</td>
                  <td class="px-4 py-3 font-semibold text-text-main truncate max-w-[120px]">${row.teamName}</td>
                  <td class="px-4 py-3 text-right font-medium text-text-sub">${row.won}-${row.lost}</td>
                  <td class="px-4 py-3 text-right">
                    <span class="bg-[#EEF2FF] text-accent px-1.5 py-0.5 rounded text-[10px] font-bold">
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
      <section class="bg-white border border-border-subtle rounded-[12px] flex flex-col overflow-hidden shadow-sm order-1 lg:order-2 flex-grow">
        <div class="px-4 py-3 bg-[#FAFAFA] border-b border-border-subtle flex justify-between items-center text-[0.75rem] font-bold text-text-sub uppercase tracking-wider">
          <span>Match Schedule</span>
          <span class="text-text-sub">
            ${completedCount} / ${tournament.matches.length} Finished
          </span>
        </div>
        <div class="p-6 overflow-y-auto space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${tournament.matches
              .filter(m => m.teamAId !== 'BYE' && m.teamBId !== 'BYE')
              .map(match => {
                const teamA = tournament.teams.find(t => t.id === match.teamAId) || { name: match.teamAId === 'TBD' ? 'To Be Determined' : match.teamAId };
                const teamB = tournament.teams.find(t => t.id === match.teamBId) || { name: match.teamBId === 'TBD' ? 'To Be Determined' : match.teamBId };
                const isTBD = match.teamAId === 'TBD' || match.teamBId === 'TBD';
                const isLive = !isTBD && match.status !== 'completed';
                
                return `
                  <div class="p-4 rounded-lg border transition-all ${match.status === 'completed' ? 'bg-slate-50/50 border-border-subtle' : isTBD ? 'bg-slate-50/30 border-border-subtle opacity-50' : 'bg-white border-border-subtle shadow-sm'}">
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-text-sub">
                        ${tournament.format === 'elimination' ? (match.round === 3 ? 'Final' : match.round === 2 ? 'Semi-Final' : `Round ${match.round}`) : `Match ${match.round}`}
                      </span>
                      ${isLive ? '<span class="text-[10px] font-bold text-success animate-pulse">LIVE</span>' : ''}
                      ${match.status === 'completed' ? `<span class="text-success">${Icons.CheckCircle2}</span>` : ''}
                    </div>

                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-4">
                        <span class="text-[0.875rem] font-medium truncate ${match.status === 'completed' && (match.scoreA || 0) > (match.scoreB || 0) ? 'text-accent' : 'text-text-main'}">
                          ${teamA.name}
                        </span>
                        ${!isTBD ? `<input type="number" data-match-id="${match.id}" data-team="A" value="${match.scoreA !== undefined ? match.scoreA : ''}" class="score-input w-12 h-8 text-center text-sm border border-border-subtle rounded font-bold outline-none focus:border-accent bg-white">` : ''}
                      </div>
                      <div class="flex items-center justify-between gap-4">
                        <span class="text-[0.875rem] font-medium truncate ${match.status === 'completed' && (match.scoreB || 0) > (match.scoreA || 0) ? 'text-accent' : 'text-text-main'}">
                          ${teamB.name}
                        </span>
                        ${!isTBD ? `<input type="number" data-match-id="${match.id}" data-team="B" value="${match.scoreB !== undefined ? match.scoreB : ''}" class="score-input w-12 h-8 text-center text-sm border border-border-subtle rounded font-bold outline-none focus:border-accent bg-white">` : ''}
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
      <section class="bg-white border border-border-subtle rounded-[12px] flex flex-col overflow-hidden shadow-sm order-3">
        <div class="px-4 py-3 bg-[#FAFAFA] border-b border-border-subtle text-[0.75rem] font-bold text-text-sub uppercase tracking-wider">
          Tournament Stats
        </div>
        <div class="p-6 space-y-6">
          <div class="grid grid-cols-2 gap-2">
            <div class="p-4 bg-[#F3F4F6] rounded-lg text-center">
              <div class="text-2xl font-bold text-text-main">${completed.length}</div>
              <div class="text-[0.65rem] font-bold text-text-sub uppercase tracking-widest">Games Played</div>
            </div>
            <div class="p-4 bg-[#F3F4F6] rounded-lg text-center">
              <div class="text-2xl font-bold text-text-main">${avgPts}</div>
              <div class="text-[0.65rem] font-bold text-text-sub uppercase tracking-widest">Avg Pts/GM</div>
            </div>
          </div>

          <div class="space-y-2 pt-4">
            <div class="text-[0.75rem] font-bold text-text-sub uppercase tracking-wider mb-2">Live Insights</div>
            <div class="px-4 py-3 border border-border-subtle rounded-lg flex items-center justify-between">
              <span class="text-xs font-semibold text-text-sub">Total Points Scored</span>
              <span class="text-sm font-bold text-text-main">${totalPoints}</span>
            </div>
            <div class="px-4 py-3 border border-border-subtle rounded-lg flex items-center justify-between">
              <span class="text-xs font-semibold text-text-sub">Current Leader</span>
              <span class="text-sm font-bold text-accent">${standings[0]?.teamName || 'N/A'}</span>
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
        newItemInput.onkeypress = (e) => {
          if (e.key === 'Enter') {
            this.state.type === 'team' ? this.addTeam() : this.addPlayer();
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