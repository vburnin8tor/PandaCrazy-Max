/**
 * Class dealing with any listening to messages from other scripts or extensions.
 * @class ListenerClass ##
 * @author JohnnyRS - johnnyrs@allbyjohn.com
 */
class ListenerClass {
  constructor() {
    chrome.runtime.onMessage.addListener( (request, sender, sendResponse) => { console.info(request.command);
      if (sender.url && !sender.url.includes('generated_background_page')) {
        let command = request.command, data = request.data;
        if (command && data) {
          if (command.substring(0, 3) === 'add') { if (pandaUI) pandaUI.addFromExternal(request); }
          else if (command === 'projectedEarnings') { if (pandaUI) pandaUI.setEarnings(data.projectedEarnings); }
          else if (command === 'getQueueData') { if (pandaUI && bgQueue) bgQueue.sendQueueResults(sendResponse); }
          else if (command === 'submitted') { if (pandaUI) pandaUI.submittedHit(request); }
          else if (command === 'returned') { if (pandaUI) pandaUI.returnedHit(request); }
          else if (command === 'acceptedhit') { if (pandaUI) pandaUI.acceptedHit(request); }
          else if (command === 'getJobs') { if (pandaUI) pandaUI.getAllData(sendResponse); }
          else if (command === 'startcollect') { if (pandaUI && data.hasOwnProperty('id')) { let myId = bgPanda.getMyId(data.id); if (myId >= 0) pandaUI.startCollecting(myId); }}
          else if (command === 'stopcollect') { if (pandaUI && data.hasOwnProperty('id')) { let myId = bgPanda.getMyId(data.id); if (myId >= 0) pandaUI.stopCollecting(myId); }}
          else if (command === 'getGroups') { if (pandaUI && groupings) sendResponse({'for':'getGroups', 'response':groupings.theGroups()}); }
          else if (command === 'startgroup' || command === 'stopgroup') { if (pandaUI && groupings && data.hasOwnProperty('id')) groupings.externalCommand(command, data.id); }
          else if (command === 'removeJob') { if (pandaUI && bgPanda && data.hasOwnProperty('id')) { pandaUI.extRemoveJob(data.id, sendResponse); }}
          else if (command === 'getTriggers') { if (MySearchUI && MySearch) MySearch.getAllTriggers(sendResponse); }
          else if (command === 'startSearching') { if (MySearchUI && data.hasOwnProperty('id')) MySearchUI.startSearching(); }
          else if (command === 'stopSearching') { if (MySearchUI && data.hasOwnProperty('id')) MySearchUI.stopSearching(); }
          else if (command === 'enableTrigger') { if (MySearchUI && MySearch && data.hasOwnProperty('id')) MySearchUI.externalSet(data.id, true) }
          else if (command === 'disableTrigger') { if (MySearchUI && MySearch && data.hasOwnProperty('id')) MySearchUI.externalSet(data.id, false); }
          else if (command === 'getSGroups') { if (MySearchUI && sGroupings) sendResponse({'for':'getSGroups', 'response':sGroupings.theGroups()}); }
          else if (command === 'enableSgroup' || command === 'disableSgroup') { if (MySearchUI && sGroupings && data.hasOwnProperty('id')) sGroupings.externalCommand(command, data.id); }
          else if (command === 'removeTrigger') { if (MySearchUI && MySearch && data.hasOwnProperty('id')) MySearch.removeTrigger(data.id,_,_, true, true, sendResponse); }
          else if (command === 'getStats') { if (pandaUI) pandaUI.sendStats(sendResponse); }
          else if (command === 'pause') { if (pandaUI) pandaUI.pauseToggle(true); }
          else if (command === 'unpause') { if (pandaUI) pandaUI.pauseToggle(false); }
          else if (command === 'forumOptions') { if (pandaUI && MyOptions) sendResponse(MyOptions.theHelperOptions()); }
          else if (command === 'queueOptions') { if (pandaUI && MyOptions) MyOptions.theSessionQueue(data); if (sendResponse) sendResponse(MyOptions.theHelperOptions()); }
          else if (command === 'monitorSpeech') { if (pandaUI && !MyOptions.doGeneral().disableMonitorAlert) MyAlarms.speakThisNow('HITs in Queue. Going to first.'); }
          else console.info(JSON.stringify(request), sender);
        }
      }
      return true;
    });
  }
}
