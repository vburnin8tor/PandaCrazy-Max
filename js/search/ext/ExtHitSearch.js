class ExtHitSearch {
  constructor(pcm_channel, theHitSearch) {
    this.pcm_channel = pcm_channel;
    this.searchGStats = {};
    this.searchOn = false;
    this.loggedoff = false;
    this.theHitSearch = theHitSearch;
    this.searchChannel = new BroadcastChannel('PCM_kSearch_band');
  }
  async sendBroadcastMsg(msg, retMsg, value=null, timeoutVal=null, timeoutTime=500) {
    const search2Channel = new BroadcastChannel('PCM_kSearch2_band');
    return new Promise( (resolve) => {
      search2Channel.postMessage({'msg':msg, 'value':value});
      search2Channel.onmessage = async (e) => { console.log(e.data);
        search2Channel.close();
        if (e.data.msg === retMsg && e.data.value) resolve(e.data.value);
        else resolve(false);
      }
      setTimeout(() => { search2Channel.close(); resolve(timeoutVal); }, timeoutTime);
    });
  }
  timerChange(timer) { if (this.theHitSearch) return this.theHitSearch.timerChange(timer); }
  pandaToDbId(pDbId) { if (this.theHitSearch) return this.theHitSearch.pandaToDbId(pDbId); }
  getData(dbId) { if (this.theHitSearch) return this.theHitSearch.getData(dbId); }
  uniqueToDbId(unique) { if (this.theHitSearch) return this.theHitSearch.uniqueToDbId(unique); }
  setTempBlockGid(gId, block, rIdBlock) { if (this.theHitSearch) this.theHitSearch.setTempBlockGid(gId, block, rIdBlock) }
  createReqUrl(rId) { if (this.theHitSearch) return this.theHitSearch.createReqUrl(rId); }
  goFetch(objUrl, queueUnique, elapsed, dbId, type, value, sUI, lookGid) { if (this.theHitSearch) this.theHitSearch.goFetch(objUrl, queueUnique, elapsed, dbId, type, value, sUI, lookGid); }
  isPandaUI() { if (this.theHitSearch) return this.theHitSearch.isPandaUI(); }
  async loadFromDB() { if (this.theHitSearch) await this.theHitSearch.loadFromDB(); }
	autoHitsAllow(status) { if (this.theHitSearch) return this.theHitSearch.autoHitsAllow(status); }
	async optionsChanged(changes, dbId) { if (this.theHitSearch) await this.theHitSearch.optionsChanged(changes, dbId); }
	async getFromDB(name, dbId, indexName, cursor, asc, limit) { if (this.theHitSearch) return await this.theHitSearch.getFromDB(name, dbId, indexName, cursor, asc, limit); }
	async theData(dbId, name, changed) { if (this.theHitSearch) return await this.theHitSearch.theData(dbId, name, changed); }
	getBlocked(gId) { if (this.theHitSearch) return this.theHitSearch.getBlocked(gId); }
	theBlocked(gId, rId, add, remove, toggle) { if (this.theHitSearch) return this.theHitSearch.theBlocked(gId, rId, add, remove, toggle); }
	getFrom(type) { if (this.theHitSearch) return this.theHitSearch.getFrom(type); }
  async toggleTrigger(unique, passedDbId, forceEnabled) { if (this.theHitSearch) return this.theHitSearch.toggleTrigger(unique, passedDbId, forceEnabled); }
  async getTrigger(dbId) { if (this.theHitSearch) return this.theHitSearch.getTrigger(dbId); }
  
  prepareSearch() { this.searchChannel.postMessage({'msg':'search: prepareSearch'}); }
  stopSearching() { this.searchChannel.postMessage({'msg':'search: stopSearching'}); }
  unPauseTimer() { this.searchChannel.postMessage({'msg':'search: unPauseTimer'}); }
  
  async doRidSearch() { return await this.sendBroadcastMsg('search: doRidSearch', 'search: returning doRidSearch', null, false); }
  async sendToPanda() { return await this.sendBroadcastMsg('search: sendToPanda', 'search: returning sendToPanda', null, false); }
  async startSearching() { return await this.sendBroadcastMsg('search: startSearching', 'search: returning startSearching', null, false); }
  async pauseToggle() { return await this.sendBroadcastMsg('search: pauseToggle', 'search: returning pauseToggle', [...arguments], null); }
  async isEnabled() { return await this.sendBroadcastMsg('search: isEnabled', 'search: returning isEnabled', [...arguments], null); }
  async optionsCopy() { return await this.sendBroadcastMsg('search: optionsCopy', 'search: returning optionsCopy', [...arguments], null); }
	async rulesCopy() { return await this.sendBroadcastMsg('search: rulesCopy', 'search: returning rulesCopy', [...arguments], null); }
  async addTrigger() { return await this.sendBroadcastMsg('search: addTrigger', 'search: returning addTrigger', [...arguments], null); }
  async removeTrigger() { return await this.sendBroadcastMsg('search: removeTrigger', 'search: returning removeTrigger', [...arguments], null); }

  // Combo methods for specific multiple actions needed instead of sending multiple messages.
  async doFilterSearch() { return await this.sendBroadcastMsg('search: doFilterSearch', 'search: returning doFilterSearch', [...arguments], null); }
  async getToggleTrigger() { return await this.sendBroadcastMsg('search: getToggleTrigger', 'search: returning getToggleTrigger', [...arguments], null); }
  async getDataTrigger() { return await this.sendBroadcastMsg('search: getDataTrigger', 'search: returning getDataTrigger', [...arguments], null); }
  async goCheckGroup() { return await this.sendBroadcastMsg('search: goCheckGroup', 'search: returning goCheckGroup', [...arguments], null); }
  async sortingTriggers() { return await this.sendBroadcastMsg('search: sortingTriggers', 'search: returning sortingTriggers', [...arguments], null, 2000); }
}

function searchListener(data) {
  if (data) {
    let obj = data.object, value = data.value;
    if (data.msg === 'search: go for start') { console.log('Go ahead and start search crazy'); startNow(); }
    else if (data.msg === 'search: abort start') console.log('Do not start search crazy because of error.');
    else if (data.msg === 'search: DB loaded') { MySearchUI.appendFragments(); setTimeout( () => { modal.closeModal('Loading Data'); }, 300); }
    else if (data.msg === 'search: logged on') { MySearchUI.nowLoggedOn(); this.loggedon = true; }
    else if (data.msg === 'search: logged off') { MySearchUI.nowLoggedOff(); this.loggedon = false; }
    else if (data.msg === 'search: importing') { MySearchUI.importing(); }
    else if (data.msg === 'search: importing done') { MySearchUI.importingDone(); }
    else if (data.msg === 'search: stop searching') { MySearchUI.stopSearching(true); }
    else if (data.msg === 'search: append fragments') { MySearchUI.appendFragments(); }
    else if (value) {
      if (data.msg === 'search: reset tooltips') { MySearchUI.resetToolTips(value); }
      else if (data.msg === 'search: redo filters') { MySearchUI.redoFilters(value); }
      else if (data.msg === 'search: remove trigger') { MySearchUI.removeTrigger(value); }
    } else if (obj) {
      if (data.msg === 'search: add to UI') { MySearchUI.addToUI(obj.trigger, obj.status, obj.name, obj.unique); }
      else if (data.msg === 'search: update stats nav') { MySearchUI.updateStatNav(obj.statObj, obj.text); }
      else if (data.msg === 'search: status me') { MySearchUI.statusMe(obj.unique, obj.status); }
      else if (data.msg === 'search: update stats') { MySearchUI.updateStats(obj.count, obj.data); }
      else if (data.msg === 'search: triggered hit') { MySearchUI.triggeredHit(obj.count, obj.data, obj.item, obj.term, obj.started, obj.auto); }
      else if (data.msg === 'search: move to search') { MySearchUI.addToUI(obj.data, obj.status, obj.name, obj.count); MySearchUI.redoFilters(obj.type); MySearchUI.appendFragments(); }
    }
    console.log('got msg:', data.msg);
  }
};
