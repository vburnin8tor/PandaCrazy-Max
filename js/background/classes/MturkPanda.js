'use strict';
/** This class takes care of the panda jobs data. Also handles dealing with the database to get data.
 * @class MturkPanda
 * @extends MturkClass
 * @author JohnnyRS - johnnyrs@allbyjohn.com */
class MturkPanda extends MturkClass {
	/**
	 * @param {number} timer		- Time to use for the timer to get next panda.
	 * @param {number} hamTimer - Time to use for the ham timer.
	 */
	constructor(timer, hamTimer) {
		super();																// Run the super extended constructor first.
		this.dbName = "PandaCrazyMax";					// Name of the database used for all storage.
		this.storeName = "pandaStore"; 					// Name of the store to be used for panda jobs.
		this.tabsStore = "tabsStore";						// Name of the store for panda tabs.
		this.optionsStore = "optionsStore";			// Name of the store for options.
		this.groupingStore = "groupingStore";		// Name of the store for saving groupings.
		this.alarmsStore = "alarmsStore";				// Name of the store for saving user selected alarms.
		this.uniqueIndex = 0;										// unique number for a panda.
		this.pandaUniques = [];									// Array of all unique numbers being used now.
		this.searchesUniques = [];							// Array of all search jobs unique numbers being used now.
		this.searchesReqIds = {};								// Array of all requester ID's of search jobs being used now.
		this.searchesGroupIds = {};							// Array of all group ID's of search jobs being used now.
		this.pandaGroupIds = {};								// Object of all groupId's with unique ID value for easy searching.
		this.dbIds = {};												// Object of all dbId's with myId value for easy searching.
		this.info = {};													// Object of panda info.
    this.pandaUrls = {};										// Array of panda objects for a panda with preview and accept links.
		this.pandaSkipped = [];									// List of all panda's being skipped because of limits.
		this.pandaSkippedData = {};							// List of all panda data which are being skipped.
		this.queueAdds = {};										// Object of panda accepted hits so it can limit number of accepts.
		this.loggedOff = false;									// Are we logged off from mturk?
		this.resultsBack = true;								// Jobs using limits need to know when results come back from Mturk.
		this.tempPaused = false;								// Used to pause timer if queue is maxxed or a mturk problem.
		this.skippedDoNext = false;							// Used when checking skipped jobs in a recursive function.
		this.authenticityToken = null;					// The authenticity token from mturk so hits can be returned.
		if (timer) {
			pandaTimer.setMyClass(this, true);			// Tell timer what class is using it so it can send information back.
			pandaTimer.theTimer(timer);         		// Set timer for this timer.
			pandaTimer.pleaseSendBack();         		// Set timer for this timer.
			pandaTimer.theHamTimer(hamTimer);   		// Set hamTimer for this timer.
		}
		this.useDefault = false;								// Should we be using default values because no data in database?
		this.db = null;						  						// Set up the database class.
	}
	/** Returns the option info about a panda job with the unique ID.
	 * @param  {number} myId - The unique ID for a panda job.
	 * @return {object}			 - The options for this panda job with the unique ID. */
	options(myId) { return (this.info.hasOwnProperty(myId)) ? this.info[myId] : null; }
	/** Returns the data for this job with the unique ID. Assumes the data has been loaded already.
	 * @param  {number} myId - The unique ID for a panda job.
	 * @return {object}			 - The data for the job with the unique ID. Returns null if data is not loaded.*/
	data(myId) { return (this.info.hasOwnProperty(myId) && this.info[myId].data) ? this.info[myId].data : null; }
	/** If logged off then returns true.
	 * @return {bool} - True if logged off. */
	isLoggedOff() { return this.loggedOff; }
	/** Converts the unique database ID to the equivalent unique panda job ID.
	 * @param  {number} dbId - The unique database ID for a panda job.
	 * @return {number}			 - Returns the unique databse ID from a unique panda job ID. */
	getMyId(dbId) { return this.dbIds[dbId]; }
	/** Creates a panda accept url for groupid.
	 * @param  {string} groupId - The groupId of the panda to creat a url.
	 * @return {string}					- Returns the created string. */
	createPandaUrl(groupId) { return `https://worker.mturk.com/projects/${groupId}/tasks/accept_random`; }
	/** Creates a preview url for groupid.
	 * @param  {string} groupId - The groupId of the panda to creat a url.
	 * @return {string}					- Returns the created string. */
	createPreviewUrl(groupId) { return `https://worker.mturk.com/projects/${groupId}/tasks`; }
	/** Tests if the database can be opened and has all the storage created.
	 * @async 				- To wait for the results of the database testing of the storage in the database.
	 * @return {bool} - True if database is all ready. */
	async testDB() {
		let result = await this.db.testDB().then( () => { return true; }, () => {
			return this.openDB(true).then( () => { return true; }, rejected => { dbError = rejected; return false; });
		});
		return result;
	}
  /** Open database or create it with all storage objects. This uses a promise so program will wait.
	 * @param  {bool}	[del=false]				 - Should the database be deleted first?
	 * @return {Promise<response|Error>} - Resolves with the response and rejects with the error. */
  openDB(del=false) {
    return new Promise( (resolve, reject) => {
			this.db = new DatabaseClass(this.dbName, 1);
    	this.db.openDB( del, (e) => {
				if (e.oldVersion === 0) { // Had no database so let's initialise it.
          e.target.result.createObjectStore(this.storeName, {keyPath:"id", autoIncrement:"true"})
          	.createIndex("groupId", "groupId", {unique:false});
          e.target.result.createObjectStore(this.tabsStore, {keyPath:"id", autoIncrement:"true"})
          	.createIndex("position", "position", {unique:false});
          e.target.result.createObjectStore(this.optionsStore, {keyPath:"category"});
					e.target.result.createObjectStore(this.alarmsStore, {keyPath:"id", autoIncrement:"true"})
						.createIndex("name", "name", {unique:false});
					e.target.result.createObjectStore(this.groupingStore, {keyPath:"id", autoIncrement:"true"});
					this.useDefault = true; // If data initialized then let other classes know to use default values.
        }
      } ).then( response => resolve(response), rejected => { console.error(rejected); reject(rejected); });
    });
	}
	wipeData() {
		let db1 = new DatabaseClass(this.dbName, 1); db1.deleteDB(); db1 = null;
		let db2 = new DatabaseClass("Pcm_PandaStats", 1); db2.deleteDB(); db2 = null;
	}
	/** Loads data for this particular job with unique ID in the info object or returns the value of a property.
	 * If database rejected then give error on console and on page before stopping script.
	 * @async 							        - To wait to get the data from the database.
	 * @param  {number} myId        - The unique ID for a panda job.
	 * @param  {string} [prop=null] - The property to load from database and returned. Does not load data in memory.
	 * @return {object} 		        - Returns the value of the property supplied from databse or nothing. */
	async getDbData(myId, prop=null) {
		await this.db.getFromDB(this.storeName, this.info[myId].dbId)
		.then( r => { if (prop && r.hasOwnProperty(prop)) return r[prop]; else this.info[myId].data = r; },
			rejected => { extPandaUI.haltScript(rejected, 'Failed loading data from database for a panda so had to end script.', `Error getting data for ${myId} Error:`); }
		);
	}
	/** Adds data to the database and sets the id in info to the key resolved from database.
	 * @async										- To wait for the adding of data in the database.
	 * @param  {object} newData - New data @param  {bool} [multiple=false] - Does the data object have multiple items to add? */
	async addToDB(newData, multiple=false) {
		await this.db.addToDB(this.storeName, newData).then( id => {
			if (!multiple) newData.id = id;
			else for (const data of newData) data.myId = this.uniqueIndex++;
		}, rejected => { extPandaUI.haltScript(rejected, 'Failed adding new data to database for a panda so had to end script.', 'Error adding panda data. Error:'); }
		);
	}
	/** Updates the data for this panda using the unique ID. Key should already be in the data object.
	 * @async									- To wait for the updating of data in the database
	 * @param  {number} myId	- TUnique ID @param  {object} [newData=null] - Object to update panda with or use the data in the panda info object. */
	async updateDbData(myId, newData=null) {
		await this.db.addToDB(this.storeName, (newData) ? newData : this.info[myId].data).then( id => newData.id = id,
			rejected => { extPandaUI.haltScript(rejected, 'Failed updating data to database for a panda so had to end script.', 'Error adding panda data. Error:'); }
		);
		const dbId = (newData) ? newData.id : this.info[myId].id;
		if (this.dLog(3)) console.info(`%cUpdating data for dbId: ${dbId}.`,CONSOLE_INFO);
	}
	/** Delete the panda data and stats with this unique ID from the databases.
	 * @async								 - To wait for the deletion of data from the database.
	 * @param  {number} myId - The unique ID for a panda job. */
	async deleteDbData(myId, data) {
		extPandaUI.deleteFromStats(myId, this.info[myId].dbId);
		myHistory.deleteThis(data.groupId); myHistory.deleteThis(data.reqId);
		await this.db.deleteFromDB(this.storeName, this.info[myId].dbId).then( () => {},
			() => { if (this.dError(1)) console.error('Got an error while trying to delete a panda from database.'); });
		if (this.dLog(3)) console.info(`%cDeleting panda ${myId} from Database.`,CONSOLE_INFO);
	}
	/** Load up data from the database for every panda added or add panda to the panda UI.
	 * @async													- To wait for all the data to be loaded into memory.
	 * @param  {bool} [addPanda=true] - Should the data be added to panda UI or just adding data to memory?
	 * @return {object}								- Returns rejected object on database error. */
	async getAllPanda(addPanda=true) {
		let err = null;
		await this.db.getFromDB(this.storeName).then( async result => {
			for (const r of result) {
				if (addPanda) await extPandaUI.addPandaDB(r); // Add panda straight from the database info.
				else if (this.dbIds.hasOwnProperty(r.id)) this.info[this.dbIds[r.id]].data = r; // Add the data to memory
			}
		}, rejected => err = rejected );
    if (this.dLog(3)) console.info('%cGetting all data for panda\'s.',CONSOLE_INFO);
		return err;
	}
	/** Closes the database and sets the database variable to null. */
	closeDB() { this.db.closeDB(); this.db = null; }
	/** Recreates the database after it's closed usually only used when importing data.
	 * @async - To wait for the database and the search database to open. */
	async recreateDB() { await this.openDB(true); await mySearch.openDB(true); }
	/** This will remove all or non collecting jobs panda data from memory to save memory space.
	 * @param  {bool} [all=true]		 - Should all the data be removed from memory or only non collecting jobs?
	 * @param  {bool} [update=false] - Should the database get updated after removing from memory? */
	/** Remove all panda jobs usually because panda UI is closing.
	 * @param {bool} - Should the pandaUI be asked to remove all also?
	 * @async 			 - To wait for all the data to be added first before removing the jobs. */
	async removeAll(removeUI=false) {
		if (removeUI && extPandaUI) await extPandaUI.removeAll();
		this.uniqueIndex = 0; this.pandaUniques = []; this.searchesUniques = []; this.dbIds = {};
		this.pandaGroupIds = {}; this.pandaUrls = {}; this.pandaSkipped = []; this.authenticityToken = null;
		this.pandaSkippedData = {};	this.queueAdds = {}; this.tempPaused = false; this.skippedDoNext = false;
		this.searchesReqIds = {}; this.searchesGroupIds = {}; this.info = {};
	}
	/** Removes all the data objects usually on first startup.
	 * @param  {bool} [all=true] - All or just non collecting ones. @param  {bool} [update=false] - Update to database too? */
	nullData(all=true, update=false) {
		for (const myId of Object.keys(this.info)) {
			if (update && this.info[myId].data) this.updateDbData(null, Object.assign({}, this.info[myId].data));
			if (all || !extPandaUI.pandaStats[myId].collecting) this.info[myId].data = null;
		}
    if (this.dLog(3)) console.info('%cRemoving all data from memory.',CONSOLE_INFO);
	}
	/** Gets the data from the database if needed and then returns the data object.
	 * @async 							 - To wait to get the data from the database if needed.
	 * @param  {number} myId - The unique ID for a panda job.
	 * @return {object}      - The data object is returned. */
	async dataObj(myId) {
		if (!this.info[myId].data) await this.getDbData(myId);
		return this.info[myId].data; 
	}
	/** Collects stats from timer and shows them on the panda UI.
	 * @param  {object} infoObj - The object with all the timer status. */
	timerInfo(infoObj) {
		if (extPandaUI) {
			if (infoObj.goingHam!==null) extPandaUI.cards.hamButtonOn(infoObj.myIdHam); else extPandaUI.cards.hamButtonsOff();
			extPandaUI.collectingStatus(infoObj.running, infoObj.paused);
		}
	}
	/** Changes the time for the panda timer and returns the time saved.
	 * @param  {number} [timer=null] - Time change @param  {number} [add=0] - Milliseconds to add @param  {number} [del=0] - Milliseconds to decrease
	 * @return {number}				       - Returns the panda timer time that was set. */
	timerChange(timer=null, add=0, del=0) {
		let newTimer = null;
		if (timer) newTimer = pandaTimer.theTimer(timer, true);
		else if (add>0) newTimer = pandaTimer.addToTimer(add);
		else if (del>0) newTimer = pandaTimer.delFromTimer(del);
		else if (!timer) newTimer = pandaTimer.theTimer();
		return newTimer
	}
	/** Changes the ham time for the panda timer and returns the ham time saved.
	 * @param  {number} timer - The time to change the ham timer to.
	 * @return {number}				- Returns the ham timer time that was set. */
	hamTimerChange(timer=null) { return pandaTimer.theHamTimer(timer); }
	/** Changes the time for the queue timer and returns the time saved.
	 * @param  {number} timer - The time to change the queue timer to.
	 * @return {number}				- Returns the queue timer time that was set. */
	queueTimerChange(timer) { return myQueue.timerChange(timer); }
	/** Tells panda timer to stop all jobs in queue. */
	async stopAll() { pandaTimer.stopAll(); await this.searchingStopped(); }
	/** Toggle the panda timer pause status with the value sent or returns the value of the pause value instead.
	 * @param  {bool} val - Sets the timer to the value or returns pause status if null.
	 * @return {number}   - Returns the status of the panda timer pause mode. */
	pauseToggle(val=null) { if (val != null) return pandaTimer.paused(val); else return pandaTimer.pauseToggle(); }
	/** Finds out if the panda timer is in go ham mode and returns status.
	 * @return {bool} - Returns true if timer is in ham mode. */
	isTimerGoingHam() { return pandaTimer.goingHam; }
	/** Tell panda timer to go ham on this panda with the queue unique id and use the temporary ham duration.
	 * @param  {number} queueUnique   - Unique number for the panda in timer queue.
	 * @param  {number} [tGoHam=null] - The temporary duration for the goHam timer. */
	timerGoHam(queueUnique, tGoHam=null) { if (queueUnique) pandaTimer.goHam(queueUnique, tGoHam) }
	/** Turn off the go ham in panda timer for this panda with the queue unique id.
	 * @param  {number} [queueUnique=null] - Unique number for the panda in timer queue. */
	timerHamOff(queueUnique=null) { pandaTimer.hamOff(queueUnique); }
	/** Tell panda timer to reset the time started for the temporary duration.
	 * @param  {number} queueUnique - Unique number for the panda in timer queue. */
	resetTimerStarted(queueUnique) { pandaTimer.resetTimeStarted(queueUnique); }
	/** Unpause the panda timer. */
	unPauseTimer() { pandaTimer.paused = false; }
	/** When logged off this will pause the panda timer and let panda UI know it's logged off. */
	nowLoggedOff() { if (extPandaUI) extPandaUI.nowLoggedOff(); pandaTimer.paused = true; this.loggedOff = true; }
	/** When logged back in this will unpause the panda timer and let panda UI know it's logged back in. */
	nowLoggedOn() { this.unPauseTimer(); this.loggedOff = false; if (extPandaUI) extPandaUI.nowLoggedOn(); }
	/** Send the collection status and group ID for this panda to the search class.
	 * @param  {object} data - The object data for job to send status of to search class.
	 * @param  {bool} status - The collection status of this panda. */
	sendStatusToSearch(data, status) { mySearch.pandaStatus(data.groupId, status); }
	/** Will add fetched to search jobs when seach class fetches a hit list. */
	searchFetched() {
		for (const unique of this.searchesUniques) { if (extPandaUI.pandaStats[unique].doSearching()) extPandaUI.pandaStats[unique].addFetched(); }
	}
	/** Stop searching for all search jobs. */
	async searchingStopped() { for (const unique of this.searchesUniques) { await this.disableSearching(unique, null, true); } }
	/** Add search trigger to search class and tell panda UI that this hit is searching now.
	 * @async													 - To wait for the getting of the data if data isn't loaded.
	 * @param  {number} myId					 - The unique number ID for this job.
	 * @param  {object} hitData=null	 - The data object for this job. */
	async doSearching(myId, hitData=null) {
		if (!hitData) { hitData = await this.dataObj(myId); }
		mySearch.doSearching(hitData.id, false);
		if (extPandaUI) { extPandaUI.searchingNow(myId); }
	}
	/** Disables this search job as disabled on the panda UI and in the search class if needed.
	 * @param  {number} myId							  - The unique number ID for this job.
	 * @param  {object} [hitData=null]			- The data object for this job.
	 * @param  {bool} [disableTrigger=true] - Should trigger be disabled in search class too? */
	async disableSearching(myId, hitData=null, disableTrigger=true) {
		let info = this.info[myId]; hitData = (hitData) ? hitData : await this.dataObj(myId);
		if (disableTrigger) {
			let value = (info.search === 'gid') ? hitData.groupId : hitData.reqId;
			mySearch.doDisabled(info.search, value, false);
		}
		if (extPandaUI) extPandaUI.searchDisabled(myId); // Mark this search job as disabled here
	}
	/** Returns the first job using the groupID depending on if it's a search job.
	 * @param  {string} gid 						- Group ID to search for.
	 * @param  {string} [searchType=''] - The type of search job that was used to find hit.
	 * @return {number}									- The unique ID for the job first using group ID. */
	checkExisting(gid, searchType='') {
		let sGid = this.searchesGroupIds.hasOwnProperty(gid);
		let pGid = this.pandaGroupIds.hasOwnProperty(gid);
		if (sGid && searchType === 'gid') return this.searchesGroupIds[gid][0];
		else if (pGid && sGid) {
			let list = this.pandaGroupIds[gid], i = 0, len = list.length, uniqueNum = null;
			while (i < len && this.searchesUniques.includes(list[i])) { i++; }
			if (i < len) uniqueNum = this.pandaGroupIds[gid][i];
			return uniqueNum;
		}
		else if (pGid) return this.pandaGroupIds[gid][0];
		else return null;
	}
	/** Starts collecting the panda with the unique ID and send info to the panda timer.
	 * @async												 - To wait for the data to be loaded for this job.
	 * @param  {number} myId				 - The unique ID for a panda job.
	 * @param  {bool} goHamStart		 - Go ham at start?
	 * @param  {number} tempDuration - Temporary duration for this job used for external panda adds.
	 * @param  {number} tempGoHam		 - Temporary go ham duration for this job used for external panda adds.
	 * @return {bool}								 - True if collection has started. */
	async startCollecting(myId, goHamStart, tempDuration, tempGoHam) {
		let hitInfo = this.info[myId], data = await this.dataObj(myId);
		let stopReason = this.checkIfLimited(myId, false, data), disabled = (hitInfo.disabled) ? hitInfo.disabled : false;
		if (disabled) stopReason = 'Job is disabled.';
		if (stopReason === null) { // If there was a limit to stop then don't add to queue.
			this.info[myId].queueUnique = pandaTimer.addToQueue(myId, (timerUnique, elapsed, myId) => {
				if (this.info[myId].data) this.goFetch(this.pandaUrls[myId].urlObj, timerUnique, elapsed, myId); // Do this function every cycle.
			}, async (myId) => {
				const tData = await this.dataObj(myId), data = Object.assign({}, tData);
				if (extPandaUI) {
					let accepted = extPandaUI.pandaStats[myId].accepted.value;
					let searching = (this.info[myId].search!==null && ((data.once && accepted === 0) || !data.once));
					await extPandaUI.stopCollecting(myId, null, false, searching); // Do after when timer is removed from queue.
					if (searching) this.doSearching(myId, data, tempDuration, tempGoHam);
					else this.info[myId].data = null;
				}
			}, goHamStart, data.duration, tempDuration, tempGoHam, this.info[myId].skipped);
			if (this.info[myId].search!==null) extPandaUI.searchCollecting(myId);
			this.sendStatusToSearch(data,true);
			if (data.autoGoHam) extPandaUI.cards.startAutoGoHam(myId);
			if (this.dLog(3)) console.info(`%cStarting to collect ${myId}.`,CONSOLE_INFO);
			return true;
		} else {
			if (this.dLog(2)) console.info(`%cStopping. Limit reached. Reason: ${stopReason} on ${myId}.`,CONSOLE_WARN);
			extPandaUI.stopCollecting(myId);
			return false;
		}
	}
	/** Stops collecting this panda with this unique ID.
	 * @param  {number} myId					 - The unique ID for a panda job.
	 * @param  {number} hitData				 - The data object for this hit.
	 * @param  {string} [whyStop=null] - Reason why collecting is stopping. */
	stopCollecting(myId, hitData, whyStop=null) {
		let queueUnique = this.info[myId].queueUnique, search = this.info[myId].search;
		pandaTimer.deleteFromQueue(queueUnique); // delete from queue if it still has a timer
		if (search) {
			if (["once","Daily Accept Limit","Fetched Limit","manual","noQual","blocked"].includes(whyStop)) {
				this.disableSearching(myId, hitData);
			}
		}
		this.sendStatusToSearch(hitData, false); // Tell search page that this panda is not collecting.
	}
	/** Sorts group ID and requester ID's into objects for search jobs so it makes it easier to find.
	 * @param  {number} myId - myId. @param  {string} groupId - Group ID @param  {string} reqId	- Requester ID @param  {string} search	- Search type */
	sortUniqueIds(myId, groupId, reqId, search) {
		this.pandaUniques.push(myId);
		if (groupId && groupId.charAt(0).toUpperCase() !== 'A') buildSortObject(this.pandaGroupIds, groupId, myId);
		if (search) this.searchesUniques.push(myId);
		if (search === 'rid' && reqId.charAt(0).toUpperCase() === 'A') buildSortObject(this.searchesReqIds, reqId, myId);
		else if (search === 'gid' && groupId.charAt(0).toUpperCase() !== 'A') buildSortObject(this.searchesGroupIds, groupId, myId);
	}
	/** Sends information to the search class to make a search trigger and save to database.
	 * @param  {number} myId - MyID        @param  {object} dbInfo   - Data object @param  {object} rules   - Rules object   @param  {object} history - History object
	 * @param  {bool} run 	 - Run it now	 @param  {number} [sDur=0] - Duration    @param  {number} [sGD=0] - Goham duration */
	async sendToSearch(myId, dbInfo, rules, history, run, sDur=0, sGD=0) {
		let tempInfo = {'name':dbInfo.reqName, 'reqId':dbInfo.reqId, 'groupId':dbInfo.groupId, 'title':dbInfo.title, 'reqName':dbInfo.reqName, 'pay':dbInfo.price, 'duration':dbInfo.assignedTime, 'status':'disabled', 'pandaId':myId, 'pDbId':dbInfo.id};
		let tempOptions = {'duration':sDur * 1000, 'once':dbInfo.once, 'limitNumQueue':dbInfo.limitNumQueue, 'limitTotalQueue':dbInfo.limitTotalQueue, 'limitFetches':dbInfo.limitFetches, 'autoGoHam':false, 'tempGoHam':sGD * 1000, 'acceptLimit':0};
		if (run) await mySearch.addTrigger(dbInfo.search, tempInfo, tempOptions, rules, history, false);
		else mySearch.addTrigger(dbInfo.search, tempInfo, tempOptions, rules, history, false);
	}
	/** Add a panda to the panda UI and save to database if it wasn't saved before.
	 * @async												 - To wait for the data to be added to databse if needed.
	 * @param  {object} dbInfo			 - Data    @param  {bool} autoAdded  - Auto added  @param  {object} passInfo     - Pass Info
	 * @param  {object} rules 			 - Rules   @param  {object} history  - History     @param  {bool} [update=false] - Updated
	 * @param  {bool} [loaded=false] - Loaded  @param  {number} [sDur=0] - Duration    @param  {number} [sGD=0] 		 - Goham duration */
	async addPanda(dbInfo, autoAdded, passInfo, rules={}, history={}, update=false, loaded=false, sDur=0, sGD=0) {
		const myId = this.uniqueIndex++; // get the next unique ID for this new panda
		if (update) await this.updateDbData(null, dbInfo); // Updates panda if it was added by default.
		this.sortUniqueIds(myId, dbInfo.groupId, dbInfo.reqId, dbInfo.search);
		if (!dbInfo.hasOwnProperty("id")) await this.addToDB(dbInfo); // Add to database if it has no database key.
		this.dbIds[dbInfo.id] = myId;
		this.info[myId] = {'queueUnique':null, 'autoAdded':autoAdded, 'dbId':dbInfo.id, 'skipped':false, 'autoTGoHam':'off', 'data':dbInfo, 'lastTime':null, 'lastElapsed':0, 'search':dbInfo.search, 'disabled':dbInfo.disabled};
		const pandaUrl = this.createPandaUrl(dbInfo.groupId); // create the panda url for this panda
		if (dbInfo.search) await this.sendToSearch(myId, dbInfo, rules, history, passInfo.run, sDur, sGD);
		this.pandaUrls[myId] = {preview: this.createPreviewUrl(dbInfo.groupId), accept: pandaUrl, urlObj: new UrlClass(pandaUrl + "?format=json")};
		myHistory.fillInHistory({[dbInfo.groupId]:dbInfo}, 'pandas', loaded);
		if (extPandaUI && !loaded) extPandaUI.addPandaToUI(myId, this.info[myId], passInfo, loaded);
	}
	/** Remove the panda with the unique ID and delete from database if necessary.
	 * @async									 - To wait for the complete deletion of the job from the database.
	 * @param  {number} myId	 - The unique ID for a panda job.
	 * @param  {bool} deleteDB - Should panda be deleted from database? */
	async removePanda(myId, deleteDB) {
		const tData = await this.dataObj(myId), data = Object.assign({}, tData);
		this.stopCollecting(myId, data, null);
		this.pandaUniques = arrayRemove(this.pandaUniques,myId); this.searchesUniques = arrayRemove(this.searchesUniques,myId);
		flattenSortObject(this.pandaGroupIds, data.groupId, myId);
		if (data.search) {
			if (data.search === "gid") flattenSortObject(this.searchesGroupIds, data.groupId, myId);
			if (data.search === "rid") flattenSortObject(this.searchesReqIds, data.reqId, myId);
			const value = (data.search === "gid") ? data.groupId : data.reqId;
			mySearch.removeTrigger(_, data.id,_, false, true);
		}
		if (deleteDB) this.deleteDbData(myId, data);
		delete this.dbIds[this.info[myId].dbId]; this.info[myId].data = null; delete this.info[myId]; delete this.pandaUrls[myId];
	}
	/** Changes the duration on the panda timer for panda with myid.
	 * @async 									 - To wait for the loading of data if needed.
	 * @param  {number} myId		 - The unique ID for a panda job. */
	async timerDuration(myId) {
		let data = await this.dataObj(myId);
		pandaTimer.changeDuration(this.info[myId].queueUnique, data.duration);
	}
	/** Gets data from mturk hit details and assigns them to the panda info object.
	 * @param  {object} details - Object with all the details from the hit.
	 * @param  {number} myId		- The unique ID for a panda job.
	 * @param  {object} data		- The data object for the hit with the unique ID.
	 * @return {string}					- Returns the assignment ID for hit. */
	parseHitDetails(details, myId, data) {
		let assignment_id="";
		if (data.limitNumQueue>0) 
			this.queueAdds[myId] = (this.queueAdds.hasOwnProperty(myId)) ? this.queueAdds[myId]+1 : 1;
		if (details.contactRequesterUrl!=="") {
			const regex = /assignment_id=([^&]*)&.*requester_id\%5D=([^&]*)&.*Type%29\+(.*)$/;
			let [all, assignId, reqId, groupId] = details.contactRequesterUrl.match(regex);
			data.reqId = reqId; data.groupId = groupId; assignment_id = assignId;
		}
		data.reqName = details.requesterName; data.title = details.projectTitle; data.description = details.description;
		data.price = details.monetaryReward.amountInDollars; data.hitsAvailable = details.assignableHitsCount;
		data.assignedTime = details.assignmentDurationInSeconds; data.expires = details.expirationTime;
		extPandaUI.cards.updateAllCardInfo(myId, this.info[myId]); this.updateDbData(null, data);
		return assignment_id;
	}
	/** Updates the requester name of this hit in the database.
	 * @async										- To wait for the data to be loaded from database if needed.
	 * @param  {number} myId 		- The unique ID for this job.
	 * @param  {string} reqName - The new name of this requester. */
	async updateReqName(myId, reqName) {
		const data = await this.dataObj(myId);
		data.reqName = reqName; extPandaUI.cards.updateAllCardInfo(myId, this.info[myId]); this.updateDbData(null, data);
	}
	/** If there is a queue limit for this hit with the unique ID then skip it.
	 * @param  {number} myId - The unique ID for this job.
	 * @param  {number} info - The information object for the hit with the unique ID.
	 * @param  {number} data - The data object for the hit with the unique ID.
	 * @return {bool} 			 - True if there is a number hit or total queue limit. */
	checkQueueLimit(myId, info, data) {
		if (!info.skipped) {
			let hits = extPandaUI.totalResults(data.groupId), skipIt='';
			if (data.limitNumQueue > 0 && data.limitNumQueue <= hits) skipIt='hit queue limit.';
			if (data.limitTotalQueue > 0 && data.limitTotalQueue <= extPandaUI.getQueueTotal() ) skipIt='queue total limit.';
			if (skipIt !== '') {
				extPandaUI.cards.cardEffectPreviousColor(myId, true, "#ffa691");
				pandaTimer.hamOff(info.queueUnique); // Make sure go ham is off if this panda was going ham.
				this.pandaSkipped.push(myId); info.skipped = true; this.pandaSkippedData[myId] = Object.assign({}, data);
				pandaTimer.skipThis(info.queueUnique);
				extPandaUI.cards.collectTipChange(myId, `<br><strong>Skipping because ${skipIt}</strong>`, true);
				return true;
			} else return false;
		} else return true;
	}
	/** If this hit with unique ID was being skipped then check if it should be unskipped.
	 * @param  {number} myId    			 - The unique ID for this job.
	 * @param  {object} [newData=null] - Data object if needed. Only used when user changes job options.
	 * @return {bool}				   				 - True if this hit is being unskipped now. */
	checkSkipped(myId, newData=null) {
		if (newData) this.pandaSkippedData[myId] = newData;
		let data = this.pandaSkippedData[myId], hits = extPandaUI.totalResults(data.groupId), unskip = true;
		if (data.limitTotalQueue > 0 && extPandaUI.getQueueTotal() >= data.limitTotalQueue) unskip = false;
		if (unskip && data.limitNumQueue > 0 && hits >= data.limitNumQueue) unskip=false;
		if (unskip) {
			extPandaUI.cards.cardEffectPreviousColor(myId,false);
			pandaTimer.unSkipThis(this.info[myId].queueUnique); // Unskip this panda in timer.
			if (this.pandaSkipped.includes(myId)) { this.pandaSkipped = arrayRemove(this.pandaSkipped, myId); delete this.pandaSkippedData[myId]; }
			this.info[myId].skipped = false; // This hit not skipped
			extPandaUI.cards.collectTipChange(myId, '');
			if (!extPandaUI.pandaStats[myId].collecting) this.info[myId].data = null;
			return true;
		} else return false;
}
	/** Checks if this panda has any limits and returns any relevant info.
	 * @param  {number} myId   - The unique ID for a panda job.
	 * @param  {bool} accepted - Was a hit accepted right now?
	 * @param  {obejct} data 	 - The data object for the hit with the unique ID.
	 * @return {string}				 - Reason for stopping as a string or null if not stopped. */
	checkIfLimited(myId, accepted, data) {
		let stopIt=null, stats = extPandaUI.pandaStats[myId];
		if (accepted && data.once) stopIt = "once"; // Panda is limited to collecting only once so stop it.
		else if (accepted && this.info[myId].autoAdded && data.hitsAvailable === 1) stopIt = "One Hit Available";
		else if (data.acceptLimit>0 && data.acceptLimit<=stats.getDailyAccepted()) stopIt = "Daily Accept Limit";
		else if (data.limitFetches>0 && data.limitFetches<=stats.getFetchedSession()) stopIt = "Fetched Limit";
		else { if (this.info[myId].skipped) this.checkSkipped(myId); else this.checkQueueLimit(myId, this.info[myId], data); }
		if (stopIt!==null) {
			extPandaUI.cards.stopItNow(myId, false, stopIt);
			extPandaUI.cards.collectTipChange(myId, `<br><strong>Stopped for ${stopIt}</strong>`, true);
		}
		return stopIt;
	}
	/** Sends the panda job info and the hit details from mturk to the queue class so the queue is updated.
	 * @param  {object} pandaInfo	 - The panda job info that just got a hit accepted.
	 * @param  {object} hitDetails - The details from mturk about the hit that was accepted. */
	queueAddAccepted(pandaInfo, hitDetails) { myQueue.addAccepted(pandaInfo, hitDetails); }
	/** This method gets called when a new queue result from mturk was grabbed so variables can be updated.
	 * @param  {object} queueResults			- Object with all the jobs in mturk queue.
	 * @param  {string} authenticityToken - Token given by mturk so hits can be returned. */
	gotNewQueue(queueResults, authenticityToken) {
		if (extPandaUI) {
			if (this.loggedOff) this.nowLoggedOn(); // If mturk gave queue results then user is logged on.
			this.authenticityToken = authenticityToken; this.queueAdds = {};
			extPandaUI.gotNewQueue(queueResults);
		}
	}
	/** When something new is in queue then check skipped hits to see if they can be unskipped. */
	doNewChecks() {
		if (this.pandaSkipped.length && !this.skippedDoNext) goNext(0, this.pandaSkipped.length, this);
		if (this.tempPaused && extPandaUI.getQueueTotal() < 25) {
			pandaTimer.paused = false; this.tempPaused = false;
		}
		/** Recursion function which checks the first hit in skipped array and then places it back in array
		 * if it needs to skip again. Uses a timeout to call the function again for each hit in skipped array.
		 * @param  {number} count    - The current counter for next skipped hit to check.
		 * @param  {number} length   - The length of the skipped hit array to limit recursion. */
		function goNext(count, length) {
			if (count<length) {
				const nextSkipped = myPanda.pandaSkipped.shift();
				myPanda.skippedDoNext = true;
				if (!myPanda.checkSkipped(nextSkipped)) myPanda.pandaSkipped.push(nextSkipped);
				if (myPanda.pandaSkipped.length>0) setTimeout( goNext, 200, ++count, length );
				else { myPanda.skippedDoNext = false; delete myPanda.pandaSkippedData[nextSkipped]; }
			} else { myPanda.skippedDoNext = false; }
		}
	}
	/** Get the group id and requester id from the preview or accept url.
	 * @param  {string} url - The url to parse and return info from.
	 * @return {array}			- Group id is first in array. Requester Id is second in array. */
	parsePandaUrl(url) {
		const groupInfo = url.match(/\/projects\/([^\/]*)\/tasks[\/?]([^\/?]*)/);
		const requesterInfo = url.match(/\/requesters\/([^\/]*)\/projects(\/|\?|$)/);
		let groupId = (groupInfo) ? groupInfo[1] : null;
		let reqId = (requesterInfo) ? requesterInfo[1] : null;
		return [groupId, reqId];
	}
	/** Fetches the url for this panda after timer class tells it to do so and handles mturk results.
	 * Can detect logged out, pre's, max hits, no more hits, no qual, blocked and accepted a hit.
	 * @async												- To wait for the fetch to get back the result from url.
	 * @param  {object} objUrl			- Url object to use when fetching.
	 * @param  {number} queueUnique - Unique number for the job in timer queue.
	 * @param  {number} elapsed			- Exact time it took for the panda timer to do next queue job.
	 * @param  {number} myId				- The unique ID for a panda job. */
	async goFetch(objUrl, queueUnique, elapsed, myId) {
		extPandaUI.pandaGStats.setPandaElapsed(elapsed);
		let resultsBack = true, info = this.info[myId];
		if ((info.data.once || info.data.limitTotalQueue>0 || info.data.limitNumQueue>0) && !this.resultsBack) resultsBack = false;
		if (!this.checkQueueLimit(myId, info, info.data) && resultsBack) {
			this.resultsBack = false;
			if (this.dLog(4)) console.debug(`%cgoing to fetch ${JSON.stringify(objUrl)}`,CONSOLE_DEBUG);
			let result = await super.goFetch(objUrl);
			if (!result) {
				if (this.dError(1)) { console.error('Result from panda fetch was a null.', JSON.stringify(objUrl)); }
			} else if (extPandaUI !== null && info.data !== null) {
				let dateNow = new Date();
				info.lastElapsed = (info.lastTime) ? dateNow - info.lastTime : 0;
				info.lastTime = dateNow;
				extPandaUI.pandaStats[myId].addFetched(); extPandaUI.pandaGStats.addTotalFetched();
				extPandaUI.cards.highlightEffect_gid(myId);
				if (result.type === "ok.text" && result.url.includes("assignment_id=")) {
					extPandaUI.hitAccepted(myId, queueUnique, result.data, result.url);
				} else {
					let stopped = this.checkIfLimited(myId, false, info.data);
					if (result.mode === "logged out" && queueUnique !== null) { this.nowLoggedOff(); }
					else if (result.mode === "pre") {
						extPandaUI.pandaGStats.addPandaPRE();
					} else if (result.mode === "mturkLimit") {
						this.tempPaused = true; pandaTimer.paused = true;
						extPandaUI.mturkLimit();
					} else if (result.mode === "maxxedOut") {
						this.tempPaused = true; pandaTimer.paused = true; extPandaUI.soundAlarm('Full');
					} else if (result.mode === "noMoreHits") {
						extPandaUI.pandaGStats.addTotalNoMore(); extPandaUI.pandaStats[myId].addNoMore();
					} else if (result.mode === "noQual" && stopped===null) {
						console.log("Not qualified"); extPandaUI.cards.stopItNow(myId, true, "noQual", "#DDA0DD");
					} else if (result.mode === "blocked") {
						console.log("You are blocked"); extPandaUI.cards.stopItNow(myId, true, "blocked", "#575b6f");
					} else if (result.mode === "notValid") {
						console.log("Group ID not found"); extPandaUI.cards.stopItNow(myId, true, "notValid", "#575b6f");
						extPandaUI.pandaGStats.addTotalPandaErrors();
					} else if (result.mode === "unknown") {
						console.log("unknown message: ",result.data.message); extPandaUI.pandaGStats.addTotalPandaErrors();
					} else if (result.mode === "cookies.large") {
						console.log("cookie large problem"); this.tempPaused = true; pandaTimer.paused = true;
						extPandaUI.pandaGStats.addTotalPandaErrors();
					} else if (result.type === "ok.text") {
						extPandaUI.soundAlarm('Captcha'); extPandaUI.captchaAlert();
						console.log("captcha found"); globalOpt.resetCaptcha();
					}
				}
				extPandaUI.updateLogStatus(myId, this.info.lastElapsed); dateNow = null;
			}
			this.resultsBack = true; result = null;
		} else if (!resultsBack) {
			if (this.dLog(2)) console.debug(`%cNo results from last fetch for job only accepting one hit.`,CONSOLE_WARN);
		}
}
	/** Checks if this error is allowed to show depending on user options and class name.
	 * (0)-fatal = Errors that can crash or stall program.
   * (1)-error = Errors that shouldn't be happening but may not be fatal.
   * (2)-warn = Warnings of errors that could be bad but mostly can be self corrected.
	 * @param  {number} levelNumber - Level number for this error.
	 * @return {bool}								- True if this error is permitted to show. */
	dError(levelNumber) { return dError(levelNumber, 'MturkPanda'); }
	/** Checks if this debug message is allowed to show depending on user options and class name.
   * (1)-info = Shows basic information of progress of program.
   * (2)-debug = Shows the flow of the program with more debugging information.
   * (3)-trace = More details shown including variable contents and functions being called.
   * (4)-trace urls = Shows full details of variables, functions, fetching urls and flow of program.
	 * @param  {number} levelNumber - Level number for this debug message.
	 * @return {bool}								- True if this message is permitted to show. */
	dLog(levelNumber) { return dLog(levelNumber, 'MturkPanda'); }
}
