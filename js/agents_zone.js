/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AGENT DISTRICT — Autonomous AI Agent Frameworks Zone (v1.0.0)
   The nerve center of agentic AI. Where autonomous agents are built, orchestrated,
   deployed, and monitored. CrewAI, LangGraph, AutoGPT, Claude Agent SDK, OpenAI Agents.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AGENT_FRAMEWORKS = {
    crewai:       { name: 'CrewAI',              ceo: 'Joao Moura',        color: '#f43f5e', icon: '👥', desc: 'Multi-agent orchestration. Role-based crews of AI agents that collaborate on complex tasks with shared memory.' },
    langgraph:    { name: 'LangGraph',           ceo: 'Harrison Chase',    color: '#22d3ee', icon: '🔗', desc: 'Stateful, multi-actor agent framework built on LangChain. Cyclic computation graphs for persistent agent workflows.' },
    autogpt:      { name: 'AutoGPT',             ceo: 'Toran Richards',    color: '#8b5cf6', icon: '🤖', desc: 'The original autonomous agent. Self-prompting GPT that decomposes goals into sub-tasks and executes them independently.' },
    claude_sdk:   { name: 'Claude Agent SDK',    ceo: 'Anthropic',         color: '#d97706', icon: '🧬', desc: 'Anthropic\'s official agent framework. Tool use, extended thinking, and guardrails for production-grade autonomous agents.' },
    openai_agent: { name: 'OpenAI Agents',       ceo: 'OpenAI',            color: '#4ade80', icon: '⚡', desc: 'OpenAI Agents Platform. Function calling, code interpreter, and retrieval for fully autonomous task execution.' },
    dify:         { name: 'Dify',                ceo: 'Luyu Zhang',        color: '#3b82f6', icon: '🎯', desc: 'Open-source LLM app development platform. Visual agent workflow builder with RAG, tools, and multi-model orchestration.' },
    n8n:          { name: 'n8n AI Agents',        ceo: 'Jan Oberhauser',    color: '#ef4444', icon: '🔄', desc: 'Workflow automation with native AI agent nodes. Connect 400+ integrations into autonomous decision-making pipelines.' },
    composio:     { name: 'Composio',            ceo: 'Karan Vaidya',      color: '#a855f7', icon: '🧩', desc: 'Tooling infrastructure for AI agents. 250+ pre-built integrations — auth, API connectors, and managed execution.' }
};

const AgentsZone = {
    BLDS: [
        { id: 'agents_orchestrator', name: 'Orchestration Hub',    w: 220, fl: 6, emoji: '🎛️', type: 'agents',
          desc: 'Central command for multi-agent systems. Workflow graphs, task decomposition, and agent-to-agent communication protocols. Every swarm starts here.' },
        { id: 'agents_toolshop',     name: 'Tool Registry',        w: 180, fl: 4, emoji: '🔧', type: 'agents',
          desc: 'Where agents acquire capabilities. API connectors, code interpreters, browser tools, and custom function registries. 2,400+ tools indexed.' },
        { id: 'agents_sandbox',      name: 'Sandbox Arena',        w: 200, fl: 5, emoji: '🏟️', type: 'agents',
          desc: 'Isolated execution environments for agent testing. SWE-bench, GAIA, and WebArena benchmarks run 24/7. Failure is cheap here.' },
        { id: 'agents_deploy',       name: 'Deployment Gateway',   w: 190, fl: 4, emoji: '🚀', type: 'agents',
          desc: 'Production deployment pipeline. Guardrails, rate limits, human-in-the-loop checkpoints, and rollback. From sandbox to production in minutes.' },
        { id: 'agents_memory',       name: 'Memory Vault',         w: 170, fl: 5, emoji: '🧠', type: 'agents',
          desc: 'Persistent agent memory store. Vector embeddings, episodic memory, shared knowledge graphs. Agents remember across sessions.' },
    ],

    NPCS: [
        { id: 'npc_agent_architect', name: 'Agent Architect',     role: 'System Design',         workplace: 'agents_orchestrator', color: '#f43f5e', shift: 'day' },
        { id: 'npc_agent_ops',       name: 'Agent Ops Lead',      role: 'Orchestration',         workplace: 'agents_orchestrator', color: '#22d3ee', shift: 'night' },
        { id: 'npc_tool_engineer',   name: 'Tool Engineer',       role: 'Integration Dev',       workplace: 'agents_toolshop',     color: '#fbbf24', shift: 'day' },
        { id: 'npc_sandbox_eng',     name: 'Sandbox Engineer',    role: 'Eval & Benchmarks',     workplace: 'agents_sandbox',      color: '#4ade80', shift: 'day' },
        { id: 'npc_guardrail_eng',   name: 'Guardrail Engineer',  role: 'Safety & Alignment',    workplace: 'agents_deploy',       color: '#ef4444', shift: 'day' },
        { id: 'npc_deploy_sre',      name: 'Deploy SRE',          role: 'Production Reliability',workplace: 'agents_deploy',       color: '#f97316', shift: 'night' },
        { id: 'npc_memory_eng',      name: 'Memory Engineer',     role: 'Knowledge Graphs',      workplace: 'agents_memory',       color: '#a855f7', shift: 'day' },
        { id: 'npc_swarm_lead',      name: 'Swarm Lead',          role: 'Multi-Agent Systems',   workplace: 'agents_sandbox',      color: '#8b5cf6', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Live stats
    agentStats: {
        activeAgents: 847,
        tasksPerHour: 12403,
        toolCalls: 89200,
        memoryOps: 4100,
        errorRate: 0.3,
        swarmSize: 24
    },
    statusTicker: [],
    tickerIdx: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Register NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }

        this._buildTicker();
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 45;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    _buildTicker() {
        this.statusTicker = [];
        const s = this.agentStats;
        this.statusTicker.push(`🤖 Active Agents: ${s.activeAgents.toLocaleString()} — ${s.swarmSize} swarms coordinating`);
        this.statusTicker.push(`⚡ Tasks/hr: ${s.tasksPerHour.toLocaleString()} — ${s.toolCalls.toLocaleString()} tool calls`);
        this.statusTicker.push(`🧠 Memory ops: ${s.memoryOps.toLocaleString()}/hr — vector store at 94% utilization`);
        this.statusTicker.push(`🔧 Tool registry: 2,418 endpoints indexed — 12 new integrations this week`);
        this.statusTicker.push(`🏟️ Sandbox: SWE-bench 48.2% · GAIA 62.1% · WebArena 38.7%`);
        this.statusTicker.push(`🚀 Deploy pipeline: 99.7% uptime — ${s.errorRate}% error rate — 3 rollbacks today`);
        this.statusTicker.push('🔗 CrewAI: 6 crews active · LangGraph: 14 flows · AutoGPT: 9 autonomous loops');
        this.statusTicker.push('🛡️ Guardrails: 12.4K/hr blocked — prompt injection, PII leak, infinite loop');

        // Shuffle
        for (let i = this.statusTicker.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.statusTicker[i], this.statusTicker[j]] = [this.statusTicker[j], this.statusTicker[i]];
        }
    },

    getNextTickerItem() {
        if (!this.statusTicker.length) return '';
        const item = this.statusTicker[this.tickerIdx % this.statusTicker.length];
        this.tickerIdx++;
        return item;
    },

    update() {
        if (!this._inited) return;
        // Vary stats for visual interest
        if (G.tick % 300 === 0) {
            this.agentStats.activeAgents = 700 + Math.floor(Math.random() * 300);
            this.agentStats.tasksPerHour = 10000 + Math.floor(Math.random() * 5000);
            this.agentStats.toolCalls = 70000 + Math.floor(Math.random() * 40000);
            this.agentStats.errorRate = +(0.1 + Math.random() * 0.5).toFixed(1);
            this.agentStats.swarmSize = 16 + Math.floor(Math.random() * 16);
        }
    },

    getFramework(name) {
        const n = name.toLowerCase();
        for (const [key, fw] of Object.entries(AGENT_FRAMEWORKS)) {
            if (n.includes(key) || n.includes(fw.name.toLowerCase())) return fw;
        }
        return null;
    }
};
