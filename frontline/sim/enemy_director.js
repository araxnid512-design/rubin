// Автономная экономика врага — точный перенос scripts/enemy_director.gd из стартового пакета.
// Детерминированная, вне экрана, с конечными ресурсами: 12 куч металлолома, реальные расходы на 12 зданий,
// найм рабочих/механиков/солдат, производство по общим рецептам. Тик — 3 секунды активного времени кампании.

export class EnemyDirector {
  constructor(config, buildingsCatalog) {
    this.config = config; this.buildingData = {};
    for (const b of buildingsCatalog.buildings || []) this.buildingData[b.id] = b;
    this.reset();
  }
  tickSeconds() { return +(this.config.ai_tick_seconds ?? 3); }
  reset() {
    this.elapsed_seconds = 0; this.next_tick_at = this.tickSeconds();
    this.scrap_metal = 0; this.total_harvested = 0; this.total_spent = 0;
    const n = +(this.config.resource_node_count ?? 12), dur = +(this.config.resource_node_durability ?? 6);
    this.scrap_durability = Array(n).fill(dur); this.scrap_respawn_at = Array(n).fill(0);
    this.structures = []; this.recruits = []; this.manufactured = {};
    this.development_index = 0; this.production_index = 0; this.next_production_at = 60;
    this.hiring = {}; this.production_job = {};
  }
  advance(seconds) {
    if (seconds <= 0) return;
    const target = this.elapsed_seconds + seconds;
    while (this.next_tick_at <= target) { this.elapsed_seconds = this.next_tick_at; this._tick(); this.next_tick_at += this.tickSeconds(); }
    this.elapsed_seconds = target;
  }
  canDeployToBattlefield(campaignElapsed) { return campaignElapsed >= +((this.config.battlefield_deployment || {}).requires_campaign_elapsed_seconds ?? 1800); }
  battleReadySoldiers() {
    const infantry = this._count('npc_infantry');
    const rifles = (this.manufactured.wp_rifle_v7 || 0) + (this.manufactured.wp_assault_a47 || 0);
    const ammo = (this.manufactured.ammo_762x54 || 0) + (this.manufactured.ammo_762x39 || 0);
    return Math.min(infantry, rifles, Math.floor(ammo / 5));
  }
  report() {
    return {
      elapsed_seconds: this.elapsed_seconds, scrap_metal: this.scrap_metal, total_harvested: this.total_harvested, total_spent: this.total_spent,
      buildings: this.structures.length, workers: this._count('npc_scrap_worker'), mechanics: this._count('npc_mechanic'), soldiers: this._count('npc_infantry'),
      battle_ready_soldiers: this.battleReadySoldiers(), produced_items: { ...this.manufactured },
    };
  }
  serialize() {
    return JSON.parse(JSON.stringify({
      elapsed_seconds: this.elapsed_seconds, next_tick_at: this.next_tick_at, scrap_metal: this.scrap_metal, total_harvested: this.total_harvested, total_spent: this.total_spent,
      scrap_durability: this.scrap_durability, scrap_respawn_at: this.scrap_respawn_at, structures: this.structures, recruits: this.recruits, manufactured: this.manufactured,
      development_index: this.development_index, production_index: this.production_index, next_production_at: this.next_production_at, hiring: this.hiring, production_job: this.production_job,
    }));
  }
  loadState(d) {
    if (!d || !Object.keys(d).length) { this.reset(); return; }
    const c = JSON.parse(JSON.stringify(d));
    this.elapsed_seconds = Math.max(0, +(c.elapsed_seconds || 0));
    this.next_tick_at = Math.max(this.elapsed_seconds, +(c.next_tick_at ?? this.elapsed_seconds + 3));
    this.scrap_metal = Math.max(0, c.scrap_metal | 0); this.total_harvested = Math.max(0, c.total_harvested | 0); this.total_spent = Math.max(0, c.total_spent | 0);
    this.scrap_durability = c.scrap_durability || []; this.scrap_respawn_at = c.scrap_respawn_at || [];
    this.structures = c.structures || []; this.recruits = c.recruits || []; this.manufactured = c.manufactured || {};
    this.development_index = Math.max(0, c.development_index | 0); this.production_index = Math.max(0, c.production_index | 0);
    this.next_production_at = +(c.next_production_at ?? this.elapsed_seconds + 30);
    this.hiring = c.hiring || {}; this.production_job = c.production_job || {};
    // неполное или старое сохранение отвергается, а не ломает массивы
    if (this.scrap_durability.length !== 12 || this.scrap_respawn_at.length !== 12) this.reset();
  }
  _tick() {
    this._refreshNodes();
    const miners = Math.min(+(this.config.miners_maximum ?? 4), 1 + this._count('npc_scrap_worker'));
    for (let i = 0; i < miners; i++) this._harvestOne();
    this._finishJobs(); this._developmentPlan(); this._startProduction();
  }
  _refreshNodes() {
    for (let i = 0; i < this.scrap_durability.length; i++) {
      if (this.scrap_durability[i] === 0 && this.scrap_respawn_at[i] <= this.elapsed_seconds) { this.scrap_durability[i] = +(this.config.resource_node_durability ?? 6); this.scrap_respawn_at[i] = 0; }
    }
  }
  _harvestOne() {
    for (let i = 0; i < this.scrap_durability.length; i++) {
      if (this.scrap_durability[i] > 0) {
        this.scrap_durability[i] -= 1;
        const earned = +(this.config.mining_scrap_per_unit ?? 5);
        this.scrap_metal += earned; this.total_harvested += earned;
        if (this.scrap_durability[i] === 0) this.scrap_respawn_at[i] = this.elapsed_seconds + +(this.config.resource_node_respawn_seconds ?? 120);
        return;
      }
    }
  }
  _developmentPlan() {
    if (Object.keys(this.hiring).length) return;
    const actions = this.config.initial_development_plan || [];
    if (this.development_index >= actions.length) return;
    const order = actions[this.development_index];
    if (order.action === 'build') {
      const b = this.buildingData[order.id]; if (!b) return;
      const cost = b.build_scrap_cost | 0; if (this.scrap_metal < cost) return;
      const lots = this.config.build_positions_xz || []; if (!lots.length) return;
      const lot = lots[this.structures.length % lots.length];
      this._spend(cost);
      this.structures.push({ id: order.id, faction: 'enemy', position_xz: [...lot], angle_degrees: 0, built_at: this.elapsed_seconds });
      this.development_index++;
    } else if (order.action === 'hire') {
      if (!this._has('military_barracks')) return;
      if (this.recruits.length + (Object.keys(this.hiring).length ? 1 : 0) >= this._barracksCapacity()) return;
      for (const r of this.buildingData.military_barracks.recruitment || []) {
        if (r.npc_role_id !== order.id) continue;
        const cost = r.scrap_cost | 0;
        if (this.scrap_metal >= cost) { this._spend(cost); this.hiring = { id: order.id, finish_at: this.elapsed_seconds + +r.seconds }; this.development_index++; }
        return;
      }
    }
  }
  _barracksCapacity() { return this.structures.filter((s) => s.id === 'military_barracks').length * (this.buildingData.military_barracks.npc_capacity || 8); }
  _finishJobs() {
    if (Object.keys(this.hiring).length && this.elapsed_seconds >= +(this.hiring.finish_at ?? Infinity)) {
      this.recruits.push({ id: this.recruits.length, role_id: this.hiring.id, faction: 'enemy', hired_at: this.elapsed_seconds, sector_id: 'enemy_home', order: 'guard_base' });
      this.hiring = {};
    }
    if (Object.keys(this.production_job).length && this.elapsed_seconds >= +(this.production_job.finish_at ?? Infinity)) {
      const id = this.production_job.id;
      this.manufactured[id] = (this.manufactured[id] || 0) + (this.production_job.quantity || 1);
      this.production_job = {};
    }
  }
  _startProduction() {
    if (this.elapsed_seconds < this.next_production_at || Object.keys(this.production_job).length) return;
    const choices = this.config.repeat_production_plan || []; if (!choices.length) return;
    const planLen = (this.config.initial_development_plan || []).length;
    for (let off = 0; off < choices.length; off++) {
      const idx = (this.production_index + off) % choices.length, a = choices[idx];
      if (!this._has(a.building_id)) continue;
      for (const rec of (this.buildingData[a.building_id] || {}).recipes || []) {
        if (rec.output_item_id !== a.recipe_output_id) continue;
        const cost = rec.scrap_cost | 0;
        // небольшой резерв, чтобы производство не задушило строительство
        if (this.scrap_metal < cost + (this.development_index < planLen ? 100 : 0)) continue;
        this._spend(cost);
        this.production_job = { id: rec.output_item_id, quantity: rec.quantity || 1, finish_at: this.elapsed_seconds + +(rec.seconds || 1) };
        this.production_index = (idx + 1) % choices.length; this.next_production_at = this.elapsed_seconds + 35;
        return;
      }
    }
    this.next_production_at = this.elapsed_seconds + 15;
  }
  _has(id) { return this.structures.some((s) => s.id === id); }
  _count(role) { return this.recruits.filter((r) => r.role_id === role).length; }
  _spend(c) { this.scrap_metal -= c; this.total_spent += c; }
}
