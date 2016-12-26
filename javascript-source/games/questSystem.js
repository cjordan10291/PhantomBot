/**
 *
 * questSystem.js
 * 
 * game module based on Phantombot's adventureSystem.js
 *
 * It's an improved adventure, basically.
 *
 * Viewers can start/join an adventure using the commands.
 * A random story will then be chosen from the available stories.
 * This means this heist can have more than one story, in fact it can have pretty much
 * an infinite amount of different locations, events etc...
 * That's just like a basic !adventure.
 *
 * However, on each quest, there is a chance to find a piece of a Key.
 *
 * These keys unlock an end quest.  Once all keys have been gathered,
 * normal quests receive a penalty towards success until the endquest
 * has been completed.
 *
 * The end quest works as follows:
 * The boss spawns with a certain point count within a range (questSettings.ultEvilMinHealth-ultEvilMaxHealth)
 * As people join, their coin counts are added together.
 * The coincount is multiplied by (1 + (questSettings.ultEvilCompanionBonus/100 * usersJoined)).  The more people, 
 * the better off everyone is.
 * 
 * This final adjusted coincount is weighted against the ultEvilHealth
 * Idea 1:  if rand100 < (100 * adjCoins) / ultEvilHealth, you win
 * Idea 2:  Straight war:  ultEvilHealth = ultEvilHealth - adjCoins.  Health drops below 0, he's banished.
 *
 * 
 *
 * When a user joins the adventure the module will check if
 * the Tamagotchi module is active and attempt to retrieve the user's tamagotchi.
 * If the user owns a tamagotchi and it's feeling good enough it wil join
 * the adventure with it's own entry of half of its owner's bet.
 * If the tamagotchi survives it wil then give it's price to it's owner.
 */
(function() {
    var joinTime = $.getSetIniDbNumber('questSettings', 'joinTime', 60),
        coolDown = $.getSetIniDbNumber('questSettings', 'coolDown', 900),
        gainPercent = $.getSetIniDbNumber('questSettings', 'gainPercent', 30),
        minBet = $.getSetIniDbNumber('questSettings', 'minBet', 10),
        maxBet = $.getSetIniDbNumber('questSettings', 'maxBet', 1000),
        enterMessage = $.getSetIniDbBoolean('questSettings', 'enterMessage', false),
        warningMessage = $.getSetIniDbBoolean('questSettings', 'warningMessage', false),
        tgFunIncr = 1,
        tgExpIncr = 0.5,
        tgFoodDecr = 0.25,
        currentAdventure = 1,
        stories = [],
        moduleLoaded = false,
        lastStory,
		greatEvilName=$.getSetIniDbString('questSettings','greatEvilName','Modnar'),
		liegeName=$.getSetIniDbString('questSettings','liegeName','Sumsum'),
		totalKeys=$.getSetIniDbNumber('questSettings', 'totalKeys', 5),
		foundKeys=$.getSetIniDbNumber('questSettings', 'foundKeys', 0),
		findKeyPercent=$.getSetIniDbNumber('questSettings', 'findKeyPercent', 20),
		startingGreatEvilStrength=$.getSetIniDbNumber('questSettings', 'startEvilStrength', 5000),
		greatEvilStrength=$.getSetIniDbNumber('questSettings', 'greatEvilStrength', 5000),
		finalHordeBonusPercent=$.getSetIniDbNumber('questSettings', 'finalHordeBonusPercent', 5),
		finalMaxBet=$.getSetIniDbNumber('questSettings', 'finalMaxBet', 3000),
		finalMinBet=$.getSetIniDbNumber('questSettings', 'finalMinBet', 200),
		finalAdventure=1
		;


    function reloadQuest () {
        joinTime = $.getIniDbNumber('questSettings', 'joinTime');
        coolDown = $.getIniDbNumber('questSettings', 'coolDown');
        gainPercent = $.getIniDbNumber('questSettings', 'gainPercent');
        minBet = $.getIniDbNumber('questSettings', 'minBet');
        maxBet = $.getIniDbNumber('questSettings', 'maxBet');
        enterMessage = $.getIniDbBoolean('questSettings', 'enterMessage');
        warningMessage = $.getIniDbBoolean('questSettings', 'warningMessage');
		greatEvilName=$.getIniDbString('questSettings','greatEvilName');
		liegeName=$.getIniDbString('questSettings','liegeName');
		totalKeys=$.getIniDbNumber('questSettings', 'totalKeys');
		foundKeys=$.getIniDbNumber('questSettings', 'foundKeys');
		findKeyPercent=$.getIniDbNumber('questSettings', 'findKeyPercent');
		startingGreatEvilStrength=$.getIniDbNumber('questSettings', 'startEvilStrength');
		greatEvilStrength=$.getIniDbNumber('questSettings', 'greatEvilStrength');
		finalHordeBonusPercent=$.getIniDbNumber('questSettings', 'finalHordeBonusPercent');
		finalMaxBet=$.getIniDbNumber('questSettings', 'finalMaxBet');
		finalMinBet=$.getIniDbNumber('questSettings', 'finalMinBet');
    };

	
	/**
     * @function loadStories
     */
	function loadFinalStories()
	{
		finalStories=[];
		loadStorySet(finalStories,'finalstories');
	};
	
    /**
     * @function loadStories
     */
    function loadStories() 
	{
		stories = [];
		loadStorySet(stories,'stories');
	}
	
	
	function loadStorySet(storyArray,storySetLabel)
	{
        var storyId = 1,
            chapterId,
            lines;

        

        for (storyId; $.lang.exists('questsystem.'+storySetLabel+'.' + storyId + '.title'); storyId++) {
            lines = [];
            for (chapterId = 1; $.lang.exists('questsystem.'+storySetLabel+'.' + storyId + '.chapter.' + chapterId); chapterId++) {
                lines.push($.lang.get('questsystem.'+storySetLabel+'.' + storyId + '.chapter.' + chapterId));
            }

            storyArray.push({
                game: ($.lang.exists('questsystem.'+storySetLabel+'.' + storyId + '.game') ? $.lang.get('questsystem.'+storySetLabel+'.' + storyId + '.game') : null),
                title: $.lang.get('questsystem.'+storySetLabel+'.' + storyId + '.title'),
                lines: lines,
            });
        }

        $.consoleDebug($.lang.get('questsystem.loaded', storyId - 1, storySetLabel));
    };
	
	

    /**
     * @function top5
     */
    function top5() {
        var payoutsKeys = $.inidb.GetKeyList('questPayouts', ''),
            temp = [],
            counter = 1,
            top5 = [],
            i;

        if (payoutsKeys.length == 0) {
            $.say($.lang.get('questsystem.top5.empty'));
        }

        for (i in payoutsKeys) {
            if (payoutsKeys[i].equalsIgnoreCase($.ownerName) || payoutsKeys[i].equalsIgnoreCase($.botName)) {
                continue;
            }
            temp.push({
                username: payoutsKeys[i],
                amount: parseInt($.inidb.get('questPayouts', payoutsKeys[i])),
            });
        }

        temp.sort(function(a, b) {
            return (a.amount < b.amount ? 1 : -1);
        });

        for (i in temp) {
            if (counter <= 5) {
                top5.push(counter + '. ' + temp[i].username + ': ' + $.getPointsString(temp[i].amount));
                counter++;
            }
        }
        $.say($.lang.get('questsystem.top5', top5.join(', ')));
    };

    /**
     * @function checkUserAlreadyJoined
     * @param {string} username
     * @returns {boolean}
     */
    function checkUserAlreadyJoined(username, thisAdventure) {
        var i;
        for (i in thisAdventure.users) {
            if (thisAdventure.users[i].username == username) {
                return true;
            }
        }
        return false;
    };

    /**
     * @function adventureUsersListJoin
     * @param {Array} list
     * @returns {string}
     */
    function adventureUsersListJoin(list) {
        var temp = [],
            i;
        for (i in list) {
            temp.push($.username.resolve(list[i].username));
        }
        return temp.join(', ');
    };

    /**
     * @function calculateResult
     */
    function calculateResult() {
        var i;
        for (i in currentAdventure.users) {
            if ($.randRange(0, 20) > 5) {
                currentAdventure.survivors.push(currentAdventure.users[i]);
            } else {
                currentAdventure.caught.push(currentAdventure.users[i]);
            }
        }
    };

    /**
     * @function replaceTags
     * @param {string} line
     * @returns {string}
     */
    function replaceTags(line,adventCaught,adventSurvivors) {
        if (line.indexOf('(caught)') > -1) {
            if (adventCaught.length > 0) {
                return line.replace('(caught)', adventureUsersListJoin(adventCaught)).replace('(greatEvil)',greatEvilName);
            } else {
                return '';
            }
        }
        if (line.indexOf('(survivors)') > -1) {
            if (adventSurvivors.length > 0) {
                return line.replace('(survivors)', adventureUsersListJoin(adventSurvivors)).replace('(greatEvil)',greatEvilName);
            } else {
                return '';
            }
        }
        return line.replace('(greatEvil)',greatEvilName);
    };

    /**
     * @function inviteTamagotchi
     * @param {string} username
     * @param {Number} bet
     */
    function inviteTamagotchi(username, bet, thisAdventure) {
        if ($.bot.isModuleEnabled('./games/tamagotchi.js')) {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            var userTG = $.tamagotchi.getByOwner(username);
            if (userTG) {
                //noinspection JSUnresolvedFunction
                if (userTG.isHappy()) {
                    //noinspection JSUnresolvedFunction
                    userTG
                        .incrFunLevel(tgFunIncr)
                        .incrExpLevel(tgExpIncr)
                        .decrFoodLevel(tgFoodDecr)
                        .save();
                    $.say($.lang.get('questsystem.tamagotchijoined', userTG.name));
                    thisAdventure.users.push({
                        username: userTG.name,
                        tgOwner: username,
                        bet: (bet / 2),
                    });
                } else {
                    //noinspection JSUnresolvedFunction
                    userTG.sayFunLevel();
                }
            }
        }
    };

    /**
     * @function startHeist
     * @param {string} username
     */
    function startHeist(username, thisAdventure) {
        thisAdventure.gameState = 1;

        var t = setTimeout(function() {
            runStory();
        }, joinTime * 1e3);
		$.say($.lang.get('questsystem.start.success', 
		  $.resolveRank(username), $.pointNameMultiple,liegeName,greatEvilName,
			foundKeys+1,
			getAbbrev(foundKeys+1)
		));

		return true;
    };
	
	    /**
     * @function startFinalAdventure
     * @param {string} username
     */
    function startFinalAdventure(username, thisAdventure) {
		var t,
		    retval=false;
		if (foundKeys==0)
		{
			$.say($.lang.get('questsystem.nokeys',
				liegeName, greatEvilName,
				((totalKeys>1)?(''+totalKeys+' '):('')),
				((totalKeys>1)?('s'):('')),
				$.pointNameMultiple
			));
		}
		else if (foundKeys < totalKeys)
		{
			$.say($.lang.get('questsystem.start.success', 
			  $.resolveRank(username), $.pointNameMultiple,liegeName,greatEvilName,
				foundKeys+1,
				getAbbrev(foundKeys+1)
			  ));
		}
		else
		{
			$.consoleLn("gamestate set to 1 in startFinalAdventure");
			thisAdventure.gameState = 1;
			t = setTimeout(function() {
				runFinalStory();
			}, joinTime * 1e3);
			$.say($.lang.get('questsystem.finalbattle.start.success', 
			  liegeName,$.resolveRank(username),greatEvilName));
			retval=true;
		}
		$.consoleLn(" startFinalBattle retval="+retval);
		return retval;
    };
	
	function joinFinalBattle(sender, bet)
	{
		if (totalKeys > foundKeys)
		{
			$.say($.lang.get('questsystem.finalbattle.locked', foundKeys, totalKeys, ( (totalKeys>1)?('keys'):('key') ) ));
			return;
		}
		joinHeist(sender, bet, finalAdventure, finalMinBet, finalMaxBet);
	};

    /**
     * @function joinHeist
     * @param {string} username
     * @param {Number} bet
     * @returns {boolean}
     */
    function joinHeist(username, bet, thisAdventure, adventureMinBet, adventureMaxBet) {
		$.consoleLn("got here joinHeist top");
        if (thisAdventure.gameState > 1) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.notpossible'));
            return;
        }

        if (checkUserAlreadyJoined(username, thisAdventure)) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.alreadyjoined'));
            return;
        }

        if (bet > $.getUserPoints(username)) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.needpoints', $.getPointsString(bet), $.getPointsString($.getUserPoints(username))));
            return;
        }

        if (bet < adventureMinBet) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.bettoolow', $.getPointsString(bet), $.getPointsString(adventureMinBet)));
            return;
        }

        if (bet > adventureMaxBet) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.bettoohigh', $.getPointsString(bet), $.getPointsString(adventureMaxBet)));
            return;
        }

        if (thisAdventure.gameState == 0) {
			$.consoleLn("gamestate 0");
			if (!thisAdventure.heistFunction(username,thisAdventure))
			{
				$consoleLn("HeistFunction Return false");
				return;
			}
        } else {
			$.consoleLn("gamestate not 0");
            if (enterMessage) {
                $.say($.whisperPrefix(username) + $.lang.get('questsystem.'+thisAdventure.messageTag+'.success', $.getPointsString(bet)));
            }
        }

        thisAdventure.users.push({
            username: username,
            bet: parseInt(bet),
        });

        $.inidb.decr('points', username, bet);
        inviteTamagotchi(username, bet, thisAdventure);
        return true;
    };

    /**
     * @function runStory
     */
    function runStory() {
        var progress = 0,
            temp = [],
            story,
            line,
            t;

        currentAdventure.gameState = 2;
        calculateResult();

        for (var i in stories) {
            if (stories[i].game != null) {
                if (($.twitchcache.getGameTitle() + '').toLowerCase() == stories[i].game.toLowerCase()) {
                    //$.consoleLn('gamespec::' + stories[i].title);
                    temp.push({title: stories[i].title, lines: stories[i].lines});
                }
            } else {
                //$.consoleLn('normal::' + stories[i].title);
                temp.push({title: stories[i].title, lines: stories[i].lines});
            }
        }

        do {
            story = $.randElement(temp);
        } while (story == lastStory);

        $.say($.lang.get('questsystem.runstory', story.title, currentAdventure.users.length));
        t = setInterval(function() {
            if (progress < story.lines.length) {
                line = replaceTags(story.lines[progress],currentAdventure.caught, currentAdventure.survivors);
                if (line != '') {
                    $.say(line.replace(/\(game\)/g, $.twitchcache.getGameTitle() + ''));
                }
            } else {
                endHeist();
                clearInterval(t);
            }
            progress++;
        }, 5e3);
    };
	
	
	
	function runFinalStory() {
        var progress = 0,
            temp = [],
            story,
            line,
            t;
		$.consoleLn("Got to runFinalStory");
        finalAdventure.gameState = 2;
        calculateFinalResult();
		
		$.consoleLn("Passed calculateFinalResult runFinalStory, finalStories.length is " + finalStories.length);
        for (var i in finalStories) {
            if (finalStories[i].game != null) {
                if (($.twitchcache.getGameTitle() + '').toLowerCase() == finalStories[i].game.toLowerCase()) {
                    //$.consoleLn('gamespec::' + stories[i].title);
                    temp.push({title: finalStories[i].title, lines: finalStories[i].lines});
                }
            } else {
                //$.consoleLn('normal::' + stories[i].title);
                temp.push({title: finalStories[i].title, lines: finalStories[i].lines});
            }
        }

//        do {
            story = $.randElement(temp);
//        } while (story == lastStory);

        $.say($.lang.get('questsystem.runstory', story.title, finalAdventure.users.length));

		$.consoleLn("final story lines.length:" + story.lines.length)

        t = setInterval(function() {
            if (progress < story.lines.length) {
                line = replaceTags(story.lines[progress],finalAdventure.caught, finalAdventure.survivors);
                if (line != '') {
                    $.say(line.replace(/\(game\)/g, $.twitchcache.getGameTitle() + ''));
                }
            } else {
                endFinalStory();
                clearInterval(t);
            }
            progress++;
        }, 5e3);
    };
	
	   /**
     * @function calculateFinalResult
     */
    function calculateFinalResult() {
        var i;
        for (i in finalAdventure.users) {
            if ($.randRange(0, 20) > 5) {
                finalAdventure.survivors.push(finalAdventure.users[i]);
            } else {
                finalAdventure.caught.push(finalAdventure.users[i]);
            }
        }
		
		
		var betTotal=0;
        for (i in finalAdventure.users) {
			betTotal=betTotal+finalAdventure.users[i].bet;
		}
		
		finalAdventure.betTotal=betTotal;
		betTotal=betTotal*(1+ (finalAdventure.users.length * finalHordeBonusPercent/100));
		finalAdventure.adjustedBetTotal=betTotal;
		
		finalAdventure.greatEvilVanquished=false;
		
		if (betTotal> (1.5*greatEvilStrength) )
		{
			finalAdventure.greatEvilVanquished=true;
		}
		else
		{
			var dieRoll = $.randRange(1,100);
			
			if (dieRoll < (100*(betTotal / (betTotal+greatEvilStrength))))
			{
				finalAdventure.greatEvilVanquished=true;
			}
			else
			{
				finalAdventure.greatEvilVanquished=false;
				setGreatEvilStrength(greatEvilStrength-betTotal);
				if (greatEvilStrength < 100)
				{
					setGreatEvilStrength(100);
				}
			}
		}
		
		
		
		if (finalAdventure.greatEvilVanquished)
		{
			if (survivors.length==0 && caught.length > 0)
			{
				survivors.push(caught.pop());
			}
			
			if (survivors.length==1)
			{
				//  One survivor.  He becomes the new liege, even if he was the old liege.
				finalAdventure.newLiege=finalAdventure.survivors[0].username;
			}
			else if (survivors.length>1)
			{
				var liegeIndex=$.randRange(0,survivors.length-1);
				// We can pick a new liege
				while (survivors[liegeIndex].username.equalsIgnoreCase(liegeName))
				{
					liegeIndex=$.randRange(0,survivors.length-1);
				}
				finalAdventure.newLiege=survivors[liegeIndex].username;
			}
			
			if (caught.length > 0)  // anyone caught can be the new evil
			{
				finalAdventure.possessed=false;
				finalAdventure.newEvil=finalAdventure.caught[$.randRange(0,caught.length-1)].username;
			}
			else  if (survivors.length == 1)// solo effort to vanquish the evil; The old great evil remains
			{
				finalAdventure.newEvil=greatEvilName;
			}
			else if (survivors.length == 2)  // no caught, 2 survivors.
			{
				var evilIndex=$.randRange(0,survivors.length-1);
				while (survivors[evilIndex].username.equalsIgnoreCase(liegeName))
				{
					evilIndex=$.randRange(0,survivors.length-1);
				}
				finalAdventure.newEvil=survivors[evilIndex].username;
			}
			else // no caught, at least 3 survivors.  We can get a great evil not the current one and not the new liege
			{
				var evilIndex=$.randRange(0,survivors.length-1);
				while (survivors[evilIndex].username.equalsIgnoreCase(liegeName) || survivors[evilIndex].equalsIgnoreCase(greatEvilName))
				{
					evilIndex=$.randRange(0,survivors.length-1);
				}
				finalAdventure.newEvil=survivors[evilIndex].username;
			}
		}
    };
	
	/**
	 * @function endFinalStory - runs the end final story cleanup and payout.
	 **/
	function endFinalStory() {
        var i, pay, username, maxlength = 0;
        var temp = [], temp2=[];

		var finalGainPercentSurvive=50;
		var finalVictoryBonus=finalAdventure.greatEvilVanquished?50:0;
		
        for (i in finalAdventure.survivors) {
            if (finalAdventure.survivors[i].tgOwner) {
                finalAdventure.survivors[i].username = finalAdventure.survivors[i].tgOwner;
            }
            pay = (finalAdventure.survivors[i].bet * ((finalGainPercentSurvive + finalVictoryBonus) / 100));
            $.inidb.incr('questPayouts', finalAdventure.survivors[i].username, pay);
            $.inidb.incr('finalPayoutsTEMP', finalAdventure.survivors[i].username, pay);
            $.inidb.incr('points', finalAdventure.survivors[i].username, finalAdventure.survivors[i].bet + pay);
        }

        for (i in finalAdventure.survivors) {
            username = finalAdventure.survivors[i].username;
            maxlength += username.length();
            temp.push($.username.resolve(username) + ' (+' + $.getPointsString($.inidb.get('finalPayoutsTEMP', finalAdventure.survivors[i].username)) + ')');
        }


		
		if (finalAdventure.greatEvilVanquished)
		{
			for (i in finalAdventure.caught) {
				if (finalAdventure.caught[i].tgOwner) {
					finalAdventure.caught[i].username = finalAdventure.caught[i].tgOwner;
				}
				pay = (finalAdventure.caught[i].bet * ((finalVictoryBonus) / 100));
				$.inidb.incr('questPayouts', finalAdventure.caught[i].username, pay);
				$.inidb.incr('finalPayoutsTEMP2', finalAdventure.caught[i].username, pay);
				$.inidb.incr('points', finalAdventure.caught[i].username, /* finalAdventure.caught[i].bet +  */ pay);
			}
			for (i in finalAdventure.caught) {
				username = finalAdventure.caught[i].username;
				maxlength2 += username.length();
				temp2.push($.username.resolve(username) + ' (+' + $.getPointsString($.inidb.get('finalPayoutsTEMP2', finalAdventure.caught[i].username)) + ')');
			}
		}

        if (temp.length == 0) {
            $.say($.lang.get('questsystem.finalbattle.completed.no.win',greatEvilName, $.getPointsString(greatEvilStrength)));
        } else if (((maxlength + 14) + $.channelName.length) > 512) {
            $.say($.lang.get('questsystem.finalbattle.completed.win.total', finalAdventure.survivors.length, finalAdventure.caught.length)); //in case too many people enter.
        } else {
            $.say($.lang.get('questsystem.finalbattle.completed.win', temp.join(', ')));
        }
		
		if (temp2.length==0 && finalAdventure.greatEvilVanquished)
		{
			$.say($.lang.get('questsystem.finalbattle.completed.totalvictory'));
		} else if (((maxlength2 + 14) + $.channelName.length) > 512) {
            $.say($.lang.get('questsystem.finalbattle.completed.lose.total', finalAdventure.survivors.length, finalAdventure.caught.length)); //in case too many people enter.
        } else {
            $.say($.lang.get('questsystem.finalbattle.completed.loseshort', temp2.join(', ')));
        }

		if (finalAdventure.greatEvilVanquished)
		{
			announceNewLiege(finalAdventure.newLiege);
			setGreatEvilStrength(startingGreatEvilStrength);
			announceNewGreatEvil(finalAdventure.newEvil, finalAdventure.possessed);
			clearQuestKeys();
		}
		
        clearFinalAdventure();

        temp = "";
        $.coolDown.set('finalbattle', true, coolDown);
    };
	
	
	function announceNewGreatEvil(newEvil, wasPossessed)
	{
		if (newEvil.equalsIgnoreCase(greatEvilName))
		{
			$.say($.lang.get('questsystem.sameevil',greatEvilName));
		}
		else if (possessed)
		{
			$.say($.lang.get('questsystem.newevil.possessed',greatEvilName, newEvil));
		}
		else
		{
			$.say($.lang.get('questsystem.newevil.animated',greatEvilName, newEvil));
		}
		setGreatEvilName(newEvil);
	}
	
	function announceNewLiege(newLiege)
	{
		if (newLiege.equalsIgnoreCase(liegeName))
		{
			$.say($.lang.get('questsystem.sameliege',newLiege));
		}
		else
		{
			$.say($.lang.get('questsystem.newliege', liegeName, newLiege));
			setLiegeName(newLiege);
		}
	}
	
	/**
	 *  @function getAbbrev  - returns 'st', 'nd', for numbers.
	 **/
	function getAbbrev(number)
	{
		
		var remainder=number%10;
		if (number==12 || number == 13 || remainder==0 || remainder > 3 )
		{
			return 'th';
		}
		
		if (remainder==1)
		{
			return 'st';
		}
		if (remainder==2)
		{
			return 'nd';
		}
		if (remainder==3)
		{
			return 'rd';
		}
		
	}
	
	/**
	 *  @function checkQuestKey
	 **/
	function checkQuestKey(survivors)
	{
		if (foundKeys < totalKeys && $.randRange(1,100) <= findKeyPercent )
		{
			var numSurvivors=survivors.length;
			var chosen=0;
			var nextKey=(foundKeys+1);
			if (numSurvivors>1)
			{
				chosen=$.randRange(0,numSurvivors);
			}
			$.inidb.set('questKeyFinders', 'key'+nextKey, survivors[chosen].username);
			var keyInfo = $.lang.get('questsystem.key'+nextKey).split('|');
			$.say($.lang.get('questsystem.keyfound', $.userPrefix(survivors[chosen].username), keyInfo[1], keyInfo[0], nextKey,
			getAbbrev(nextKey)));
			setFoundKeys(foundKeys+1);
			announceFinalBattle();
		}
	}
	
	
	function displayStatus(sender)
	{
		
		// No key has been found.
		var keycountstring='No';
		var pluralverbstring=' has';
		
		if (foundKeys==totalKeys)
		{
			if (foundKeys == 1)
			{
				// The key has been found.
				keycountstring='The';
			}
			else
			{   // All keys have been found
				keycountstring='All '+totalKeys+' ';
				pluralverbstring='s have';
			}
		} else if (foundKeys > 0 )
		{
			keycountstring=''+foundKeys;
			if (foundKeys>1)
			{
				pluralverbstring='s have';
			}
		}
		
		var message = 
			$.lang.get('questsystem.status.header', sender, liegeName,'',keycountstring,pluralverbstring);
		var details='';
		
		var firstTime=true;
		var dbKeys=$.inidb.GetKeyList('questKeyFinders','');
		for (var myi in dbKeys)
		{
			if (!firstTime)
			{
				details=details+'. ';
			}
			else
			{
				details=details+' ';
				firstTime=false;
			}
			var keyNum=dbKeys[myi].substring(3);
			var adventurer=$.inidb.get('questKeyFinders',dbKeys[myi]);
			details=details+$.lang.get('questsystem.status.detail',adventurer,'',$.lang.get('questsystem.key'+keyNum).split('|')[0]);
		}
		$.say(message+details);
		announceFinalBattle();
	}
	
	function announceFinalBattle()
	{
		if (totalKeys==foundKeys)
		{
			$.say($.lang.get('questsystem.finalbattle.notice',$.pointNameMultiple,$.userPrefix(greatEvilName),
			    greatEvilStrength,$.pointNameMultiple));
		}
	}

    /**
     * @function endHeist
     */
    function endHeist() {
        var i, pay, username, maxlength = 0;
        var temp = [];

        for (i in currentAdventure.survivors) {
            if (currentAdventure.survivors[i].tgOwner) {
                currentAdventure.survivors[i].username = currentAdventure.survivors[i].tgOwner;
            }
            pay = (currentAdventure.survivors[i].bet * (gainPercent / 100));
            $.inidb.incr('questPayouts', currentAdventure.survivors[i].username, pay);
            $.inidb.incr('questPayoutsTEMP', currentAdventure.survivors[i].username, pay);
            $.inidb.incr('points', currentAdventure.survivors[i].username, currentAdventure.survivors[i].bet + pay);
        }

        for (i in currentAdventure.survivors) {
            username = currentAdventure.survivors[i].username;
            maxlength += username.length();
            temp.push($.username.resolve(username) + ' (+' + $.getPointsString($.inidb.get('questPayoutsTEMP', currentAdventure.survivors[i].username)) + ')');
        }

        if (temp.length == 0) {
            $.say($.lang.get('questsystem.completed.no.win'));
        } else if (((maxlength + 14) + $.channelName.length) > 512) {
            $.say($.lang.get('questsystem.completed.win.total', currentAdventure.survivors.length, currentAdventure.caught.length)); //in case too many people enter.
        } else {
            $.say($.lang.get('questsystem.completed', temp.join(', ')));
        }
		
		if (temp.length > 0)
		{
			checkQuestKey(currentAdventure.survivors);
		}
        clearCurrentAdventure();
        temp = "";
        $.coolDown.set('quest', true, coolDown);
		
		
    };

    /**
     * @function clearCurrentAdventure
     */
    function clearCurrentAdventure() {
        currentAdventure = {
            gameState: 0,
            users: [],
            tgOwners: [],
            survivors: [],
            caught: [],
			finalBattle: false,
			messageTag: 'join',
			heistFunction: startHeist
        }
		
        $.inidb.RemoveFile('questPayoutsTEMP');
    };
	
	function clearFinalAdventure() {
        finalAdventure = {
            gameState: 0,
            users: [],
            tgOwners: [],
            survivors: [],
            caught: [],
			finalBattle: true,
			messageTag: 'finalbattle',
			heistFunction: startFinalAdventure
        }
		
        $.inidb.RemoveFile('finalPayoutsTEMP');
        $.inidb.RemoveFile('finalPayoutsTEMP2');
    };
	
	function setLiegeName(newLiege)
	{
		liegeName=newLiege;
		$.inidb.set('questSettings', 'liegeName', liegeName);
	}

	
	function setGreatEvilStrength(value)
	{
		greatEvilStrength=parseInt(value);
		$.inidb.set('questSettings', 'greatEvilStrength', greatEvilStrength);
	}
	
	function setStartingEvilStrength(value)
	{
		startingGreatEvilStrength=parseInt(value);
		$.inidb.set('questSettings', 'startEvilStrength', startingGreatEvilStrength);
	}

	function setFoundKeys(numnum)
	{
		foundKeys=numnum;
		$.inidb.set('questSettings', 'foundKeys',foundKeys);
	}
	
	function clearQuestKeys()
	{
		$.say('Clearing keys...');
		$.inidb.RemoveFile('questKeyFinders');
		setFoundKeys(0);
		$.say('Keys cleared.');
	}

	
	function resetKeyQuest(sender)
	{
		if (! $.isAdmin(sender))
		{
			$.say($.lang.get('questsystem.command.adminonly'));
			return;
		}
		clearQuestKeys();
	}
	
	/**
     * @function displayDebug
     */
    function displayDebug() {
		$.say($.lang.get('questsystem.debug.page1',
			foundKeys, totalKeys, findKeyPercent, liegeName, greatEvilName,greatEvilStrength
		));

    };
	
	function setGreatEvilStrength(numnum)
	{
		greatEvilStrength=numnum;
		$.inidb.set('questSettings', 'greatEvilStrength',numnum);
	}
	
	
	function strengthenEvil(sender, amount)
	{
        if (amount > $.getUserPoints(sender)) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.evilgrows.needpoints', $.getPointsString(amount), $.getPointsString($.getUserPoints(username)), $.pointNameMultiple));
            return;
        }
		setGreatEvilStrength(greatEvilStrength+amount);
		$.inidb.decr('points', username, amount);
		$.say($.lang.get('questsystem.evilgrows.addpoints',$.userPrefix(sender),amount,$.pointNameMultiple,greatEvilName, greatEvilStrength, $.pointNameMultiple));
	}
	
	
	function finalBattle()
	{
		if (checkUserAlreadyJoined(username,finalAdventure)) {
            if (!warningMessage) return;
            $.say($.whisperPrefix(username) + $.lang.get('questsystem.alreadyjoined'));
            return;
        }
	}
    /**
     * @event command
     */
    $.bind('command', function(event) {
        var sender = event.getSender().toLowerCase(),
            command = event.getCommand(),
            args = event.getArgs(),
            action = args[0],
            actionArg1 = args[1],
            actionArg2 = args[2];

        /**
         * @commandpath finalbattle - command for final battle status and initiation
         * @commandpath finalbattle [amount] - Start/join a final battle
         */			
		if (command.equalsIgnoreCase('finalbattle')) {
            if (!action || isNaN(parseInt(action))) {
                $.say($.whisperPrefix(sender) + $.lang.get('questsystem.finalbattle.usage', $.pointNameMultiple,
					((totalKeys==foundKeys)?(''):(' not')),
					foundKeys, totalKeys, 
					((totalKeys>1)?('keys'):('key'))
				));
                return;
            }

			joinFinalBattle(sender, parseInt(action));
			return;
		}	
		
		if (command.equalsIgnoreCase('evilgrows')) {
            if (!action || isNaN(parseInt(action))) {
                $.say($.whisperPrefix(sender) + $.lang.get('questsystem.evilgrows.usage', $.pointNameMultiple,
					greatEvilName, greatEvilStrength, $.pointNameMultiple
				));
                return;
            }

			strengthenEvil(sender, parseInt(action));
			return;
		}
	

        /**
         * @commandpath quest - Adventure command for starting, checking or setting options
         * @commandpath quest [amount] - Start/join an quest
         */
        if (command.equalsIgnoreCase('quest')) {
            if (!action) {
                $.say($.whisperPrefix(sender) + $.lang.get('questsystem.quest.usage', $.pointNameMultiple,
				(($.isAdmin(sender))?(' Admins can also quest debug, quest resetkeyquest'):(''))
				));
                return;
            }

            if (!isNaN(parseInt(action))) {
                joinHeist(sender, parseInt(action),currentAdventure, minBet, maxBet);
                return;
            }

            /**
             * @commandpath quest top5 - Announce the top 5 adventurers in the chat (most points gained)
             */
            if (action.equalsIgnoreCase('top5')) {
                top5();
				return;
            }
			
            /**
             * @commandpath quest debug - display stats about the current state of quests if user is an admin
             */
            if (action.equalsIgnoreCase('debug')) {
				if (!$.isAdmin(sender))
				{
					$.say($.lang.get('questsystem.command.adminonly'));
					return;
				}
                displayDebug();
				return;
            }
			
            /**
             * @commandpath quest status - display stats about the current state of quests if user is an admin
             */
            if (action.equalsIgnoreCase('status')) {
                displayStatus(sender);
				return;
            }		

            /**
             * @commandpath quest resetkeyquest - resets all keys and clears keys found
             */
            if (action.equalsIgnoreCase('resetkeyquest')) {
                resetKeyQuest(sender);
				return;
            }		
			


            /**
             * @commandpath quest set - Base command for controlling the quest settings
             */
            if (action.equalsIgnoreCase('set')) {
                if (actionArg1 === undefined || actionArg2 === undefined) {
                    $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                    return;
                }

                /**
                 * @commandpath quest set jointime [seconds] - Set the join time
                 */
                if (actionArg1.equalsIgnoreCase('joinTime')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    joinTime = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'joinTime', parseInt(actionArg2));
                }

                /**
                 * @commandpath quest set cooldown [seconds] - Set cooldown time
                 */
                if (actionArg1.equalsIgnoreCase('coolDown')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    coolDown = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'coolDown', parseInt(actionArg2));
                }

                /**
                 * @commandpath quest set gainpercent [value] - Set the gain percent value
                 */
                if (actionArg1.equalsIgnoreCase('gainPercent')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    gainPercent = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'gainPercent', parseInt(actionArg2));
                }

                /**
                 * @commandpath quest set minbet [value] - Set the minimum bet
                 */
                if (actionArg1.equalsIgnoreCase('minBet')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    minBet = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'minBet', parseInt(actionArg2));
                }

                /**
                 * @commandpath quest set maxbet [value] - Set the maximum bet
                 */
                if (actionArg1.equalsIgnoreCase('maxBet')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    maxBet = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'maxBet', parseInt(actionArg2));
                }

                /**
                 * @commandpath quest set warningmessages [true / false] - Sets the per-user warning messages
                 */
                if (actionArg1.equalsIgnoreCase('warningmessages')) {
                    if (args[2].equalsIgnoreCase('true')) warningMessage = true, actionArg2 = $.lang.get('common.enabled');
                    if (args[2].equalsIgnoreCase('false')) warningMessage = false, actionArg2 = $.lang.get('common.disabled');
                    $.inidb.set('questSettings', 'warningMessage', warningMessage);
                }

                /**
                 * @commandpath quest set entrymessages [true / false] - Sets the per-user entry messages
                 */
                if (actionArg1.equalsIgnoreCase('entrymessages')) {
                    if (args[2].equalsIgnoreCase('true')) enterMessage = true, actionArg2 = $.lang.get('common.enabled');
                    if (args[2].equalsIgnoreCase('false')) enterMessage = false, actionArg2 = $.lang.get('common.disabled');
                    $.inidb.set('questSettings', 'enterMessage', enterMessage);
                }
				
                /**
                 * @commandpath quest set greatEvilName [string] - Sets the Great Evil's name
                 */
                if (actionArg1.equalsIgnoreCase('greatEvilName')) {
					if (!args[2])
					{
						$.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
						return;
					}
                    greatEvilName=actionArg2;
                    $.inidb.set('questSettings', 'greatEvilName', actionArg2);
                }
				
				/**
                 * @commandpath quest set liegeName [string] - Sets the liege's name
                 */
                if (actionArg1.equalsIgnoreCase('liegeName')) {
					if (!args[2])
					{
						$.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
						return;
					}
                    liegeName=actionArg2;
                    $.inidb.set('questSettings', 'liegeName', actionArg2);
                }

                /**
                 * @commandpath quest set totalKeys [value] - Set the number of keys before the final quest
                 */
                if (actionArg1.equalsIgnoreCase('totalKeys')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    totalKeys = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'totalKeys', parseInt(actionArg2));
                }

				/**
                 * @commandpath quest set startEvilStrength [value] - Set the starting strength of the evil
                 */
                if (actionArg1.equalsIgnoreCase('startEvilStrength')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    setStartingEvilStrength(parseInt(actionArg2));
                }

				/**
                 * @commandpath quest set greatEvilStrength [value] - Set the current strength of the great evil
                 */
                if (actionArg1.equalsIgnoreCase('greatEvilStrength')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    setGreatEvilStrength(parseInt(actionArg2));
                }
				
                /**
                 * @commandpath quest set foundKeys [value] - Set the number of found keys
                 */
                if (actionArg1.equalsIgnoreCase('foundKeys')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    foundKeys = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'foundKeys', parseInt(actionArg2));
                }
				
				/**
                 * @commandpath quest set findKeyPercent [value] - Set the chance to find a key on a quest
                 */
                if (actionArg1.equalsIgnoreCase('findKeyPercent')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    findKeyPercent = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'findKeyPercent', parseInt(actionArg2));
                }
				
				/**
                 * @commandpath quest set finalMinBet [value] - Set the minimum bet to join the final battle
                 */
                if (actionArg1.equalsIgnoreCase('finalMinBet')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    finalMinBet = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'finalMinBet', parseInt(actionArg2));
                }

				
				/**
                 * @commandpath quest set finalMaxBet [value] - Set the maximum bet to join the final battle
                 */
                if (actionArg1.equalsIgnoreCase('finalMaxBet')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    finalMaxBet = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'finalMaxBet', parseInt(actionArg2));
                }

				/**
                 * @commandpath quest set finalHordeBonusPercent [value] - Set the per user cumulative bonus to 
				 * bets in the final battle.  if 10 people join with 50 coins each, then final battle good side
				 * is (10*50) * ( 100% + (10 * finalHordeBonusPercent% ) )
                 */
                if (actionArg1.equalsIgnoreCase('finalMaxBet')) {
                    if (isNaN(parseInt(actionArg2))) {
                        $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.usage'));
                        return;
                    }
                    finalHordeBonusPercent = parseInt(actionArg2);
                    $.inidb.set('questSettings', 'finalHordeBonusPercent', parseInt(actionArg2));
                }
				
                $.say($.whisperPrefix(sender) + $.lang.get('questsystem.set.success', actionArg1, actionArg2));
            }
        }
    });

    /**
     * @event initReady
     */
    $.bind('initReady', function() {
        if ($.bot.isModuleEnabled('./games/questsystem.js')) {
            clearCurrentAdventure();
			clearFinalAdventure();
            if (!moduleLoaded) {
                loadStories();
				loadFinalStories();
                moduleLoaded = true;
            }
            $.registerChatCommand('./games/questsystem.js', 'quest', 7);
            $.registerChatSubcommand('quest', 'set', 1);
			$.registerChatSubcommand('quest', 'debug', 1);
			$.registerChatSubcommand('quest', 'status', 1);
			$.registerChatSubcommand('quest', 'resetkeyquest', 1);
            $.registerChatCommand('./games/questsystem.js', 'evilgrows');
            $.registerChatCommand('./games/questsystem.js', 'finalbattle');
        }
    });

    /**
     * Warn the user if the points system is disabled and this is enabled.
     */
    if ($.bot.isModuleEnabled('./games/questsystem.js') && !$.bot.isModuleEnabled('./systems/pointSystem.js')) {
        $.log.warn("Disabled. ./systems/pointSystem.js is not enabled.");
    }

    $.reloadQuest = reloadQuest;
})();
