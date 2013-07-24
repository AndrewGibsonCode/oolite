/*

oolite-ailib.js

Priority-based Javascript AI library


Oolite
Copyright © 2004-2013 Giles C Williams and contributors

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston,
MA 02110-1301, USA.

*/

"use strict";

/* AI Library */
this.name = "oolite-libPriorityAI";
this.version = "1.79";
this.copyright		= "© 2008-2013 the Oolite team.";
this.author = "cim";


/* Constructor */

this.AILib = function(ship)
{
		this.ship = ship;
		this.ship.AIScript.oolite_intership = {};
		this.ship.AIScript.oolite_priorityai = this;
		var activeHandlers = [];
		var priorityList = null;
		var parameters = {};
		var communications = {};
		var waypointgenerator = null;

		/* Private utility functions. Do not call these from external code */

		/* Considers a priority list, potentially recursively */
		this._reconsiderList = function(priorities) {
				var l = priorities.length;
				for (var i = 0; i < l; i++)
				{
						var priority = priorities[i];
						if (this.getParameter("oolite_flag_behaviourLogging"))
						{
								if (priority.label) 
								{										log(this.ship.name,"Considering: "+priority.label);
								}
								else
								{
										log(this.ship.name,"Considering: entry "+i);
								}
						}
						// always call the preconfiguration function at this point
						// to set up condition parameters
						if (priority.preconfiguration)
						{
								priority.preconfiguration.call(this);
						}
						// allow inverted conditions
						var condmet = true;
						if (priority.notcondition)
						{
								condmet = !priority.notcondition.call(this);
						}
						else if (priority.condition)
						{
								condmet = priority.condition.call(this);
						}
						// absent condition is always true
						if (condmet)
						{
								if (this.getParameter("oolite_flag_behaviourLogging"))
								{
										log(this.ship.name,"Conditions met");
								}

								// always call the configuration function at this point
								if (priority.configuration)
								{
										priority.configuration.call(this);
								}
								// this is what we're doing
								if (priority.behaviour) 
								{
										if (this.getParameter("oolite_flag_behaviourLogging"))
										{
												log(this.ship.name,"Executing behaviour");
										}

										if (priority.reconsider) 
										{
												this._resetReconsideration.call(this,priority.reconsider);
										}
										return priority.behaviour;
								}
								// otherwise this is what we might be doing
								if (priority.truebranch)
								{
										if (this.getParameter("oolite_flag_behaviourLogging"))
										{
												log(this.ship.name,"Entering truebranch");
										}

										var branch = this._reconsiderList.call(this,priority.truebranch);
										if (branch != null)
										{
												return branch;
										}
										// otherwise nothing in the branch was usable, so move on
								}
						}
						else
						{
								if (priority.falsebranch)
								{
										if (this.getParameter("oolite_flag_behaviourLogging"))
										{
												log(this.ship.name,"Entering falsebranch");
										}

										var branch = this._reconsiderList.call(this,priority.falsebranch);
										if (branch != null)
										{
												return branch;
										}
										// otherwise nothing in the branch was usable, so move on
								}
						}
				}
				if (this.getParameter("oolite_flag_behaviourLogging"))
				{
						log(this.ship.name,"Exiting branch");
				}

				return null; // nothing in the list is usable, so return
		};

		/* Only call this from aiAwoken to avoid loops */
		this._reconsider = function() {
				if (!this.ship || !this.ship.isValid || !this.ship.isInSpace)
				{
						return;
				}
				var newBehaviour = this._reconsiderList.call(this,priorityList);
				if (newBehaviour == null) {
						log(this.name,"AI '"+this.ship.AIScript.name+"' for ship "+this.ship+" had all priorities fail. All priority based AIs should end with an unconditional entry.");
						return false;
				}

				if (this.getParameter("oolite_flag_behaviourLogging"))
				{
						log(this.ship.name,newBehaviour);
				}
				newBehaviour.call(this);
				return true;
		};


		/* Resets the reconsideration timer. */
		this._resetReconsideration = function(delay)
		{
				this.ship.AIScriptWakeTime = clock.adjustedSeconds + delay;
		};


		/* ****************** General AI functions ************** */


		this.setPriorities = function(priorities) 
		{
				priorityList = priorities;
				this.setUpHandlers({});
				this.reconsiderNow();
		}


		// parameters created by Oolite must always be prefixed oolite_
		this.setCommunication = function(key, value)
		{
				communications[key] = value;
		}


		// parameters created by Oolite must always be prefixed oolite_
		this.setParameter = function(key, value)
		{
				parameters[key] = value;
		}

		this.getParameter = function(key)
		{
				if (key in parameters)
				{
						return parameters[key];
				}
				return null;
		}

		// set the waypoint generator function
		this.setWaypointGenerator = function(value)
		{
				waypointgenerator = value;
		}

		this.getWaypointGenerator = function()
		{
				return waypointgenerator;
		}


		/* Requests reconsideration of behaviour ahead of schedule. */
		this.reconsiderNow = function() 
		{
				this._resetReconsideration.call(this,0.25);
		}


		this.setUpHandlers = function(handlers)
		{
				// step 1: go through activeHandlers, and delete those
				// functions from this.ship.AIScript
				for (var i=0; i < activeHandlers.length ; i++)
				{
						delete this.ship.AIScript[activeHandlers[i]];
				}

				/* This handler must always exist for a priority AI */
				handlers.aiAwoken = function()
				{
						this._reconsider();
				}

				// step 2: go through the keys in handlers and put those handlers
				// into this.ship.AIScript and the keys into activeHandlers
				activeHandlers = Object.keys(handlers);
				for (var i=0; i < activeHandlers.length ; i++)
				{
						this.ship.AIScript[activeHandlers[i]] = handlers[[activeHandlers[i]]].bind(this);
				}

		}

		this.checkScannerWithPredicate = function(predicate)
		{
				var scan = this.getParameter("oolite_scanResults");
				if (scan == null || predicate == null)
				{
						return false;
				}
				for (var i = 0 ; i < scan.length ; i++)
				{
						if (predicate.call(this,scan[i]))
						{
								this.setParameter("oolite_scanResultSpecific",scan[i]);
								return true;
						}
				}
				return false;
		}


		this.communicate = function(key,parameter1,parameter2)
		{
				if (key in communications)
				{
						this.ship.commsMessage(expandDescription(communications[key],{"p1":parameter1,"p2":parameter2}));
				}
		}

		this.friendlyStation = function(station)
		{
				if (station.isMainStation && this.ship.bounty > 50)
				{
						return false;
				}
				return (station.target != this.ship || !station.hasHostileTarget);
		}

		this.homeStation = function() 
		{
				// home station might be the owner of the ship, or might just
				// be a group member
				if (this.ship.owner && this.ship.owner.isStation && this.friendlyStation(this.ship.owner))
				{
						return this.ship.owner;
				}
				if (this.ship.group)
				{
						for (var i = 0 ; i < this.ship.group.ships.length ; i++)
						{
								if (this.ship.group.ships[i] != this.ship && this.ship.group.ships[i].isStation && this.friendlyStation(this.ship.group.ships[i].isStation))
								{
										return this.ship.group.ships[i];
								}
						}
				}
				return null;
		}

		this.cruiseSpeed = function()
		{
				var cruise = this.ship.maxSpeed * 0.8;
				if (this.ship.group)
				{
						for (var i = 0 ; i < this.ship.group.ships.length ; i++)
						{
								if (this.ship.group.ships[i].maxSpeed >= this.ship.maxSpeed/4)
								{
										if (cruise > this.ship.group.ships[i].maxSpeed)
										{
												cruise = this.ship.group.ships[i].maxSpeed;
										}
								}
						}
				}
				if (this.ship.escortGroup)
				{
						for (var i = 0 ; i < this.ship.escortGroup.ships.length ; i++)
						{
								if (this.ship.escortGroup.ships[i].maxSpeed >= this.ship.maxSpeed/4)
								{
										if (cruise > this.ship.escortGroup.ships[i].maxSpeed)
										{
												cruise = this.ship.escortGroup.ships[i].maxSpeed;
										}
								}
						}
				}
				return cruise;
		}

		this.allied = function(ship1,ship2)
		{
				// ships in same group
				if (ship1.group && ship1.group.containsShip(ship2))
				{
						return true;
				}
				if (ship1.group && ship1.group.leader)
				{
						// ship1 is escort of ship in same group as ship2
						if (ship1.group.leader.group && ship1.group.leader.group.containsShip(ship2))
						{
								return true;
						}
				}
				// or in reverse, ship2 is the escort
				if (ship2.group && ship2.group.leader)
				{
						// ship2 is escort of ship in same group as ship1
						if (ship2.group.leader.group && ship2.group.leader.group.containsShip(ship1))
						{
								return true;
						}
				}
				// ship1 is escort of a ship, ship2 is escort of a ship, both
				// those ships are in the same group
				if (ship1.group && ship1.group.leader && ship2.group && ship2.group.leader && ship1.group.leader.group && ship1.group.leader.group.containsShip(ship2.group.leader))
				{
						return true;
				}
				// Okay, these ships really do have nothing to do with each other...
				return false;
		}

		this.isAggressive = function(ship)
		{
				if (ship && ship.isPlayer)
				{
						return !ship.isFleeing;
				}
				return ship && ship.hasHostileTarget && !ship.isFleeing && !ship.isDerelict;
		}
		
		this.isFighting = function(ship)
		{
				if (ship.isStation)
				{
						return ship.alertCondition == 3 && ship.target;
				}
				return ship && ship.hasHostileTarget;
		}


		/* ****************** Condition functions ************** */

		/* Conditions. Any function which returns true or false can be used as
		 * a condition. They do not have to be part of the AI library, but
		 * several common conditions are provided here. */

		this.conditionLosingCombat = function()
		{
				var cascade = this.getParameter("oolite_cascadeDetected");
				if (cascade != null)
				{
						if (cascade.distanceTo(this.ship) < 25600)
						{
								return true;
						}
						else
						{
								this.setParameter("oolite_cascadeDetected",null);
						}
				}
				if (this.ship.energy == this.ship.maxEnergy)
				{
						// forget previous defeats
						this.setParameter("oolite_lastFleeing",null);
				}
				if (!this.conditionInCombat()) 
				{
						return false;
				}
				var lastThreat = this.getParameter("oolite_lastFleeing");
				if (lastThreat != null && this.ship.position.distanceTo(lastThreat) < 25600)
				{
						// the thing that attacked us is still nearby
						return true;
				}
				if (this.ship.energy * 4 < this.ship.maxEnergy)
				{
						// TODO: adjust threshold based on group odds
						return true; // losing if less than 1/4 energy
				}
				var dts = this.ship.defenseTargets;
				for (var i = 0 ; i < dts.length ; i++)
				{
						if (dts[i].scanClass == "CLASS_MISSILE" && dts[i].target == this.ship)
						{
								return true;
						}
						if (dts[i].scanClass == "CLASS_MINE")
						{
								return true;
						}
				}
				// if we've dumped cargo or the group leader has, then we're losing
				if (this.ship.AIScript.oolite_intership.cargodemandpaid)
				{
						return true;
				}
				if (this.ship.group && this.ship.group.leader && this.ship.group.leader.AIScript.oolite_intership && this.ship.group.leader.AIScript.oolite_intership.cargodemandpaid)
				{
						return true;
				}
				// TODO: add some reassessment of odds based on group size
				return false; // not losing yet
		}

		this.conditionInCombat = function()
		{
				if (this.isFighting(this.ship))
				{
						return true;
				}
				var dts = this.ship.defenseTargets;
				for (var i=0; i < dts.length; i++)
				{
						if (dts[i].position.squaredDistanceTo(this.ship) < this.ship.scannerRange * this.ship.scannerRange)
						{
								return true;
						}
				}
				if (this.ship.group != null)
				{
						for (var i = 0 ; i < this.ship.group.length ; i++)
						{
								if (this.isFighting(this.ship.group.ships[i]))
								{
										return true;
								}
						}
				}
				if (this.ship.escortGroup != null)
				{
						for (var i = 0 ; i < this.ship.escortGroup.length ; i++)
						{
								if (this.isFighting(this.ship.escortGroup.ships[i]))
								{
										return true;
								}
						}
				}
				
				delete this.ship.AIScript.oolite_intership.cargodemandpaid;
				return false;
		}

		/* Ships being attacked are firing back */
		this.conditionInCombatWithHostiles = function()
		{
				if (this.isFighting(ship) && this.isAggressive(this.ship.target))
				{
						return true;
				}
				var dts = this.ship.defenseTargets;
				for (var i=0; i < dts.length; i++)
				{
						if (this.isAggressive(dts[i]) && dts[i].position.squaredDistanceTo(this.ship) < this.ship.scannerRange * this.ship.scannerRange)
						{
								return true;
						}
				}
				if (this.ship.group != null)
				{
						for (var i = 0 ; i < this.ship.group.length ; i++)
						{
								if (this.isFighting(this.ship.group.ships[i]) && this.isAggressive(this.ship.group.ships[i].target))
								{
										return true;
								}
						}
				}
				if (this.ship.escortGroup != null)
				{
						for (var i = 0 ; i < this.ship.escortGroup.length ; i++)
						{
								if (this.isFighting(this.ship.escortGroup.ships[i]) && this.isAggressive(this.ship.escortGroup.ships[i].target))
								{
										return true;
								}
						}
				}
				
				delete this.ship.AIScript.oolite_intership.cargodemandpaid;
				return false;
		}


		this.conditionHasTarget = function()
		{
				return this.ship.target != null;
		}

		this.conditionHasInterceptCoordinates = function()
		{
				return (this.getParameter("oolite_interceptCoordinates") != null);
		}


		this.conditionHasMothership = function()
		{
				return (this.ship.group && this.ship.group.leader && this.ship.group.leader != this.ship && this.ship.group.leader.escortGroup && this.ship.group.leader.escortGroup.containsShip(this.ship));
		}

		this.conditionMothershipInCombat = function()
		{
				if (this.ship.group && this.ship.group.leader && this.ship.group.leader != this.ship)
				{
						var leader = this.ship.group.leader;
						if (leader.position.distanceTo(this.ship) > this.ship.scannerRange)
						{
								return false; // can't tell
						}
						if (this.isFighting(leader))
						{
								return true;
						}
						if (leader.target && leader.target.target == leader && leader.target.hasHostileTarget)
						{
								return true;
						}
						var dts = leader.defenseTargets;
						for (var i = 0 ; i < dts.length ; i++)
						{
								if (dts[i].target == leader && dts[i].hasHostileTarget)
								{
										return true;
								}
						}
						return false;
				}
				else
				{
						// no mothership
						return false;
				}
		}

		this.conditionMothershipUnderAttack = function()
		{
				if (this.ship.group && this.ship.group.leader != this.ship && this.ship.group.leader.escortGroup.containsShip(this.ship))
				{
						var leader = this.ship.group.leader;
						if (leader.target && leader.target.target == leader && leader.target.hasHostileTarget && leader.target.position.distanceTo(this.ship) < this.ship.scannerRange)
						{
								return true;
						}
						var dts = leader.defenseTargets;
						for (var i = 0 ; i < dts.length ; i++)
						{
								if (dts[i].target == leader && dts[i].hasHostileTarget && dts[i].position.distanceTo(this.ship) < this.ship.scannerRange)
								{
										return true;
								}
						}
						return false;
				}
				else
				{
						return false;
				}
		}

		this.conditionMothershipIsAttacking = function()
		{
				if (this.ship.group && this.ship.group.leader != this.ship)
				{
						var leader = this.ship.group.leader;
						if (leader.target && this.isFighting(leader) && leader.target.position.distanceTo(this.ship) < this.ship.scannerRange)
						{
								return true;
						}
				}
				return false;
		}

		// as MothershipIsAttacking, but leader.target must be aggressive
		this.conditionMothershipIsAttackingHostileTarget = function()
		{
				if (this.ship.group && this.ship.group.leader != this.ship)
				{
						var leader = this.ship.group.leader;
						if (leader.target && this.isFighting(leader) && this.isAggressive(leader.target) && leader.target.position.distanceTo(this.ship) < this.ship.scannerRange)
						{
								return true;
						}
				}
				return false;
		}


		this.conditionNearDestination = function()
		{
				return (this.ship.destination.squaredDistanceTo(this.ship) < this.ship.desiredRange * this.ship.desiredRange);
		}


		this.conditionScannerContainsFugitive = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.bounty > 50; 
				});
		}

		this.conditionScannerContainsHunters = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return s.primaryRole == "hunter" || s.scanClass == "CLASS_POLICE" || (s.isStation && s.isMainStation);
				});
		}

		this.conditionScannerContainsPirateVictims = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						// is a pirate victim
						// has some cargo on board
						// hasn't already paid up
						return s.isPirateVictim && s.cargoSpaceUsed > 0 && (!s.AIScript || !s.AIScript.oolite_intership || !s.AIScript.oolite_intership.cargodemandpaid);
				});
		}

		this.conditionScannerContainsHuntableOffender = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						var threshold = 50 - (system.info.government * 7);
						return s.isInSpace && s.bounty > threshold; 
				});
		}

		this.conditionScannerContainsFineableOffender = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						var threshold = 50 - (system.info.government * 7);
						return s.isInSpace && s.bounty <= threshold && s.bounty > 0 && !s.markedForFines && (s.scanClass == "CLASS_NEUTRAL" || s.isPlayer) && !s.isDerelict; 
				});
		}

		this.conditionScannerContainsNonThargoid = function()
		{
				var prioritytargets = this.checkScannerWithPredicate(function(s) { 
						return s.scanClass != "CLASS_THARGOID" && s.scanClass != "CLASS_ROCK" && s.scanClass != "CLASS_CARGO";
				});
				if (prioritytargets) 
				{
						return true;
				}
				return this.checkScannerWithPredicate(function(s) { 
						return s.scanClass != "CLASS_THARGOID";
				});
		}

		
		this.conditionScannerContainsSalvageForMe = function()
		{
				if (!this.conditionCanScoopCargo())
				{
						return false;
				}
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.scanClass == "CLASS_CARGO" && s.velocity.magnitude() < this.ship.maxSpeed; 
				});
		}

		this.conditionScannerContainsMiningOpportunity = function()
		{
				// if hold full, no
				if (!this.conditionCanScoopCargo())
				{
						return false;
				}
				// need a mining laser, and for now a forward one
				if (!this.ship.forwardWeapon == "EQ_WEAPON_MINING_LASER")
				{
						return false;
				}
				return this.conditionScannerContainsRocks();
		}

		this.conditionScannerContainsRocks = function()
		{
				var scan1 = this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.isBoulder;
				});
				if (scan1)
				{
						return true;
				}
				// no boulders, what about asteroids?
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.hasRole("asteroid");
				});
		}


		this.conditionScannerContainsEscapePods = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return  s.primaryRole == "escape-capsule" && s.isInSpace && s.scanClass == "CLASS_CARGO" && s.velocity.magnitude() < this.ship.maxSpeed && this.conditionCanScoopCargo(); 
				});
		}

		this.conditionScannerContainsSalvageForGroup = function()
		{
				var maxspeed = 0;
				if (this.conditionCanScoopCargo())
				{
						maxspeed = this.ship.maxSpeed;
				}
				if (this.ship.group)
				{
						for (var i = 0; i < this.ship.group.ships.length ; i++)
						{
								var ship = this.ship.group.ships[i];
								if (ship.cargoSpaceAvailable > 0 && ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK" && ship.maxSpeed > maxspeed)
								{
										maxspeed = ship.maxSpeed;
								}
						}
				}
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.scanClass == "CLASS_CARGO" && s.velocity.magnitude() < maxspeed; 
				});
		}

		this.conditionScannerContainsSalvageForMe = function()
		{
				if (!this.conditionCanScoopCargo())
				{
						return false;
				}
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.scanClass == "CLASS_CARGO" && s.velocity.magnitude() < this.ship.maxSpeed; 
				});
		}

		this.conditionScannerContainsSalvage = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return s.isInSpace && s.scanClass == "CLASS_CARGO";
				});
		}
				

		this.conditionHasReceivedDistressCall = function()
		{
				var aggressor = this.getParameter("oolite_distressAggressor");
				var sender = this.getParameter("oolite_distressSender");
				var ts = this.getParameter("oolite_distressTimestamp");

				if (aggressor == null || !aggressor.isInSpace || sender == null || !sender.isInSpace || sender.position.distanceTo(this.ship) > this.ship.scannerRange || ts+30 < clock.adjustedSeconds)
				{
						// no, or it has expired
						this.setParameter("oolite_distressAggressor",null);
						this.setParameter("oolite_distressSender",null);
						this.setParameter("oolite_distressTimestamp",null);
						return false;
				}
				return true;
		}

		this.conditionHasWaypoint = function()
		{
				return this.getParameter("oolite_waypoint") != null;
		}

		this.conditionHasSelectedStation = function()
		{
				var station = this.getParameter("oolite_selectedStation");
				if (station && (!station.isValid || !station.isStation))
				{
						this.setParameter("oolite_selectedStation",null);
						return false;
				}
				return station != null;
		}

		this.conditionHasSelectedPlanet = function()
		{
				var planet = this.getParameter("oolite_selectedPlanet");
				if (planet && (!planet.isValid || !planet.isPlanet))
				{
						this.setParameter("oolite_selectedPlanet",null);
						return false;
				}
				return planet != null;
		}


		this.conditionInInterstellarSpace = function()
		{
				return system.isInterstellarSpace;
		}

		this.conditionWitchspaceEntryRequested = function()
		{
				return (this.getParameter("oolite_witchspaceWormhole") != null);
		}

		this.conditionSelectedStationNearby = function()
		{
				var station = this.getParameter("oolite_selectedStation");
				if (station && station.position.distanceTo(this.ship) < this.ship.scannerRange)
				{
						return true;
				}
				return false;
		}

		this.conditionSelectedStationNearMainPlanet = function()
		{
				if (!system.mainPlanet)
				{
						return false;
				}
				var station = this.getParameter("oolite_selectedStation");
				if (station && station.position.distanceTo(system.mainPlanet) < system.mainPlanet.radius * 4)
				{
						return true;
				}
				return false;
		}

		this.conditionNearMainPlanet = function()
		{
				if (!system.mainPlanet)
				{
						return false;
				}
				if (this.ship.position.distanceTo(system.mainPlanet) < system.mainPlanet.radius * 4)
				{
						return true;
				}
				return false;
		}


		this.conditionHomeStationNearby = function()
		{
				var home = this.homeStation();
				if (home == null)
				{
						return false;
				}
				return this.ship.position.distanceTo(home) < this.ship.scannerRange;
		}


		this.conditionHomeStationExists = function()
		{
				return (this.homeStation() != null);
		}


		this.conditionFriendlyStationNearby = function()
		{
				var stations = system.stations;
				for (var i = 0 ; i < stations.length ; i++)
				{
						var station = stations[i];
						if (this.friendlyStation(station))
						{
								// this is not a very good check for friendliness, but
								// it will have to do for now
								if (station.position.distanceTo(this.ship) < this.ship.scannerRange)
								{
										return true;
								}
						}
				}
				return false;
		}


		this.conditionFriendlyStationExists = function()
		{
				var stations = system.stations;
				for (var i = 0 ; i < stations.length ; i++)
				{
						var station = stations[i];
						if (this.friendlyStation(station))
						{
								// this is not a very good check for friendliness, but
								// it will have to do for now
								return true;
						}
				}
				return false;
		}

		this.conditionHasNonThargoidTarget = function()
		{
				return (this.ship.target && this.ship.target.scanClass != "CLASS_THARGOID");
		}

		this.conditionScannerContainsThargoidMothership = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return s.hasRole("thargoid-mothership");
				});
		}

		this.conditionScannerContainsReadyThargoidMothership = function()
		{
				return this.checkScannerWithPredicate(function(s) { 
						return s.hasRole("thargoid-mothership") && (!s.escortGroup || s.escortGroup.count <= 16);
				});
		}

		this.conditionScannerContainsShipNeedingEscort = function()
		{
				if (this.ship.bounty == 0)
				{
						return this.checkScannerWithPredicate(function(s) { 
								return s.scanClass == this.ship.scanClass && s.bounty == 0 && (!s.escortGroup || s.escortGroup.count <= s.maxEscorts);
						});
				}
				else
				{
						return this.checkScannerWithPredicate(function(s) { 
								return s.scanClass == this.ship.scanClass && s.bounty > 0 && (!s.escortGroup || s.escortGroup.count <= s.maxEscorts);
						});
				}
		}

		this.conditionCanWitchspaceOut = function()
		{
				if (!this.ship.hasHyperspaceMotor)
				{
						return false;
				}
				return (system.info.systemsInRange(this.ship.fuel).length > 0);
		}

		this.conditionCargoIsProfitableHere = function()
		{
				if (!system.mainStation)
				{
						return false;
				}
				if (this.ship.cargoSpaceUsed == 0)
				{
						return false;
				}
				var cargo = this.ship.cargoList;
				var profit = 0;
				var multiplier = (system.info.economy <= 3)?-1:1;
				for (var i = 0 ; i < cargo.length ; i++)
				{
						var commodity = cargo[i].commodity;
						var quantity = cargo[i].quantity;
						var adjust = system.mainStation.market[commodity].marketEcoAdjustPrice * multiplier * quantity / system.mainStation.market[commodity].marketMaskPrice;
						profit += adjust;
				}
				return (profit >= 0);
		}

		this.conditionReadyToSunskim = function()
		{
				return (this.ship.position.distanceTo(system.sun) < system.sun.radius * 1.15);
		}

		this.conditionSunskimPossible = function()
		{
				return (system.sun && 
								!system.sun.hasGoneNova && 
								!system.sun.isGoingNova && 
								this.ship.fuel < 7 && 
								this.ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK" &&
								(this.ship.heatInsulation > 1000/this.ship.maxSpeed || this.ship.heatInsulation >= 12));
		}

		this.conditionPiratesCanBePaidOff = function()
		{
				if (this.ship.AIScript.oolite_intership.cargodemandpaid)
				{
						return false;
				}
				// TODO: need some way for the player to set this
				if (!this.ship.AIScript.oolite_intership.cargodemand)
				{
						return false;
				}
				if (this.ship.cargoSpaceUsed < this.ship.AIScript.oolite_intership.cargodemand)
				{
						return false;
				}
				return true;
		}

		this.conditionIsGroupLeader = function()
		{
				if (!this.ship.group)
				{
						return true;
				}
				return (this.ship.group.leader == this.ship);
		}

		this.conditionIsEscorting = function()
		{
				if (!this.ship.group || !this.ship.group.leader || this.ship.group.leader == this.ship)
				{
						return false;
				}
				if (this.ship.group.leader.escortGroup && this.ship.group.leader.escortGroup.containsShip(this.ship))
				{
						return true;
				}
				return false;
		}

		this.conditionAllEscortsInFlight = function()
		{
				if (!this.ship.escortGroup)
				{
						return true; // there are no escorts not in flight
				}
				for (var i = 0 ; i < this.ship.escortGroup.ships.length ; i++)
				{
						if (this.ship.escortGroup.ships[i].status != "STATUS_IN_FLIGHT")
						{
								return false;
						}
				}
				return true;
		}

		this.conditionCanScoopCargo = function()
		{
				if (this.ship.cargoSpaceAvailable == 0 || this.ship.equipmentStatus("EQ_FUEL_SCOOPS") != "EQUIPMENT_OK")
				{
						return false;
				}
				return true;
		}

		this.conditionCargoDemandsMet = function()
		{
				if (!this.getParameter("oolite_flag_watchForCargo"))
				{
						log(this.name,"AI '"+this.ship.AIScript.name+"' for ship "+this.ship+" is asking if cargo demands are met but has not set 'oolite_flag_watchForCargo'");
						return true;
				}
				var seen = this.getParameter("oolite_cargoDropped");
				if (seen != null)
				{
						var recorder = null;
						var demand = 0;
						if (this.ship.group)
						{
								if (this.ship.group.leader && this.ship.group.leader.AIScript.oolite_intership && this.ship.group.leader.AIScript.oolite_intership.cargodemanded > 0)
								{
										if (this.ship.group.leader.AIScript.oolite_intership.cargodemandmet)
										{
												return true;
										}
										recorder = this.ship.group.leader;
										demand = this.ship.group.leader.AIScript.oolite_intership.cargodemanded;
								}
								else if (this.ship.group.ships[0].AIScript.oolite_intership && this.ship.group.ships[0].AIScript.oolite_intership.cargodemanded > 0)

								{
										demand = this.ship.group.ships[0].AIScript.oolite_intership.cargodemanded;							
										if (this.ship.group.ships[0].AIScript.oolite_intership.cargodemandmet)
										{
												return true;
										}
										recorder = this.ship.group.ships[0];
								}
						}
						else
						{
								if (this.ship.AIScript.oolite_intership.cargodemanded > 0)
								{
										if (this.ship.AIScript.oolite_intership.cargodemandmet)
										{
												return true;
										}
										demand = this.ship.AIScript.oolite_intership.cargodemanded;
										recorder = this.ship;
								}
						}

						if (demand == 0)
						{
								return false; // no demand made, so it can't have been met
						}
						if (demand <= seen)
						{
								recorder.AIScript.oolite_intership.cargodemandmet = true;
								return true;
						}
				}
				return false;
		}

		this.conditionGroupLeaderIsStation = function()
		{
				return (this.ship.group && this.ship.group.leader && this.ship.group.leader.isStation);
		}

		this.conditionGroupIsSeparated = function()
		{
				if (!this.ship.group || !this.ship.group.leader)
				{
						return false;
				}
				if (this.ship.group.leader.isStation)
				{
						// can get 2x as far from station
						return (this.ship.position.distanceTo(this.ship.group.leader) > this.ship.scannerRange * 2);
				}
				else
				{
						return (this.ship.position.distanceTo(this.ship.group.leader) > this.ship.scannerRange);
				}
		}

		this.conditionCombatOddsGood = function()
		{
				// TODO: this should consider what the ships are, somehow
				var us = 1;
				if (this.ship.group)
				{
						us += this.ship.group.count - 1;
				}
				if (this.ship.escortGroup)
				{
						us += this.ship.escortGroup.count - 1;
				}

				var them = 1;
				if (!this.ship.target)
				{
						return false;
				}
				else
				{
						if (this.ship.target.group)
						{
								them += this.ship.target.group.count - 1;
						}
						if (this.ship.target.escortGroup)
						{
								them += this.ship.target.escortGroup.count - 1;
						}
				}
				return us >= them;
		}

		this.conditionGroupHasEnoughLoot = function()
		{
				var used = 0;
				var available = 0;
				if (!this.ship.group)
				{
						used = this.ship.cargoSpaceUsed;
						if (this.ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK")
						{
								available = this.ship.cargoSpaceAvailable;
						}
				}
				else
				{
						for (var i = 0; i < this.ship.group.ships.length; i++)
						{
								used += this.ship.group.ships[i].cargoSpaceUsed;
								if (this.ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK")
								{
										available += this.ship.group.ships[i].cargoSpaceAvailable;
								}
						}
				}
				if (available < used || available == 0)
				{
						/* Over half-full. This will do for now. TODO: cutting
						 * losses if group is taking damage, losing ships, running
						 * low on consumables, etc. */
						return true;
				}
				return false;
		}

		this.conditionThargonIsActive = function()
		{
				return this.ship.scanClass == "CLASS_THARGOID" && this.ship.hasRole("EQ_THARGON");
		}

		this.conditionMissileOutOfFuel = function()
		{
				var range = 30000; // 30 km default
				if (this.ship.scriptInfo.oolite_missile_range)
				{
						range = this.ship.scriptInfo.oolite_missile_range;
				}
				return range < this.ship.distanceTravelled;
		}

		/* ****************** Behaviour functions ************** */

		/* Behaviours. Behaviours are effectively a state definition,
		 * defining a set of events and responses. They are aided in this
		 * by the 'responses', which mean that the event handlers for the
		 * behaviour within the definition can itself be templated.  */

		this.behaviourFleeCombat = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);

				var cascade = this.getParameter("oolite_cascadeDetected");
				if (cascade != null)
				{
						if (cascade.distanceTo(this.ship) < 25600)
						{
								if (this.ship.destination != cascade)
								{
										this.communication("oolite_quiriumCascade");
								}
								this.ship.destination = cascade;
								this.ship.desiredRange = 30000;
								this.ship.desiredSpeed = 10*this.ship.maxSpeed;
								this.ship.performFlyToRangeFromDestination();
								return;
						}
						else
						{
								this.setParameter("oolite_cascadeDetected",null);
						}
				}
				this.ship.target = this.ship.AIPrimaryAggressor;
				if (!this.ship.target || this.ship.position.distanceTo(this.ship.target) > 25600)
				{
						var dts = this.ship.defenseTargets;
						for (var i = 0 ; i < dts.length ; i++)
						{
								this.ship.position.distanceTo(dts[i]) < 25600;
								this.ship.target = dts[i];
								break;
						}
				}
				this.setParameter("oolite_lastFleeing",this.ship.target);
				this.ship.performFlee();
		}


		this.behaviourDestroyCurrentTarget = function()
		{
				this.setParameter("oolite_witchspaceEntry",null);

				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				if (this.ship.target && !this.ship.hasHostileTarget)
				{
						// entering attack mode
						this.communicate("oolite_beginningAttack",this.ship.target.displayName);
				}
				this.ship.performAttack();
		}


		this.behaviourRepelCurrentTarget = function()
		{
				this.setParameter("oolite_witchspaceEntry",null);

				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				if (!this.ship.target || !this.ship.target.isValid || !this.ship.target.isShip)
				{
						this.reconsiderNow();
						return;
				}
				if (!this.isAggressive(this.ship.target))
				{
						var target = this.ship.target;
						// repelling succeeded
						if (this.ship.escortGroup)
						{
								// also tell escorts to stop attacking it
								for (var i = 0 ; i < this.ship.escortGroup.ships.length ; i++)
								{
										this.ship.escortGroup.ships[i].removeDefenseTarget(target);
										if (this.ship.escortGroup.ships[i].target == target)
										{
												this.ship.escortGroup.ships[i].target = null;
										}
								}
						}
						this.ship.removeDefenseTarget(target);
						this.ship.target = null;
				}
				else
				{
						if (!this.ship.hasHostileTarget)
						{
								// entering attack mode
								this.communicate("oolite_beginningAttack",this.ship.target.displayName);
						}
						this.ship.performAttack();
				}
		}


		this.behaviourFineCurrentTarget = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				
				if (this.ship.scanClass == "CLASS_POLICE" && this.ship.target)
				{
						this.communicate("oolite_markForFines",this.ship.target.displayName);
						
						this.ship.markTargetForFines();
				}

				this.ship.performIdle();
		}


		this.behaviourMineTarget = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				this.ship.performMining();
		}


		this.behaviourCollectSalvage = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				handlers.shipScoopedOther = function(other)
				{
						this.setParameter("oolite_cargoDropped",null);
						this.reconsiderNow();
				}
				this.setUpHandlers(handlers);
				this.ship.performCollect();
		}


		this.behaviourApproachDestination = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);

				handlers.shipAchievedDesiredRange = function() 
				{
						var waypoints = this.getParameter("oolite_waypoints");
						if (waypoints != null)
						{
								if (waypoints.length > 0)
								{
										waypoints.pop();
										if (waypoints.length == 0)
										{
												waypoints = null;
										}
										this.setParameter("oolite_waypoints",waypoints);
								}
						}
						else
						{
								var patrol = this.getParameter("oolite_waypoint");
								if (patrol != null && this.ship.destination.distanceTo(patrol) < 1000+this.getParameter("oolite_waypointRange"))
								{
										// finished patrol to waypoint
										// clear route
										this.communicate("oolite_waypointReached");
										this.setParameter("oolite_waypoint",null);
										this.setParameter("oolite_waypointRange",null);
										if (this.getParameter("oolite_flag_patrolStation"))
										{
												if (this.ship.group)
												{
														var station = this.ship.group.leader;
														if (station != null && station.isStation)
														{
																this.communicate("oolite_patrolReportIn",station.displayName);
																this.ship.patrolReportIn(station);
														}
												}
										}
								}
						}
						this.reconsiderNow();
				};

				var waypoints = this.getParameter("oolite_waypoints");
				if (waypoints != null)
				{
						this.ship.destination = waypoints[waypoints.length-1];
						this.ship.desiredRange = 1000;
				}
				var blocker = this.ship.checkCourseToDestination();
				if (blocker)
				{
						if (blocker.isPlanet || blocker.isSun)
						{
								// the selected planet can't block
								if (blocker.isSun || this.getParameter("oolite_selectedPlanet") != blocker)
								{
										if (this.ship.position.distanceTo(blocker) < blocker.radius * 3)
										{
												if (waypoints == null)
												{
														waypoints = [];
												}
												waypoints.push(this.ship.getSafeCourseToDestination());
												this.ship.destination = waypoints[waypoints.length-1];
												this.ship.desiredRange = 1000;
										}
								}
						}
						else if (blocker.isShip)
						{
								if (this.ship.position.distanceTo(blocker) < 25600)
								{
										if (!blocker.group || !blocker.group.leader == this.ship)
										{
												// our own escorts are not a blocker!
												if (waypoints == null)
												{
														waypoints = [];
												}
												waypoints.push(this.ship.getSafeCourseToDestination());
												this.ship.destination = waypoints[waypoints.length-1];
												this.ship.desiredRange = 1000;
										}
								}
						}
				}
				this.setParameter("oolite_waypoints",waypoints);
				this.setUpHandlers(handlers);
				this.ship.performFlyToRangeFromDestination();
		}

		
		this.behaviourDockWithStation = function()
		{
				// may need to release escorts
				if (this.ship.escortGroup && this.ship.escortGroup.count > 1)
				{
						this.ship.dockEscorts();
				}
				var station = this.getParameter("oolite_dockingStation");
				this.ship.target = station;
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.responsesAddDocking(handlers);
				this.ship.requestDockingInstructions();
				switch (this.ship.dockingInstructions.ai_message)
				{
				case "TOO_BIG_TO_DOCK":
				case "DOCKING_REFUSED":
						this.ship.setParameter("oolite_dockingStation",null);
						this.ship.target = null;
						this.reconsiderNow();
						break;
				case "TRY_AGAIN_LATER":
						if (this.ship.target.position.distanceTo(this.ship) < 10000)
						{
								this.ship.destination = this.ship.target.position;
								this.ship.desiredRange = 12500;
								this.ship.desiredSpeed = this.cruiseSpeed();
								this.ship.performFlyToRangeFromDestination();
								break;
						}
						// else fall through
				case "HOLD_POSITION":
						this.ship.destination = this.ship.target.position;
						this.ship.performFaceDestination();
						// and will reconsider in a little bit
						break;
				case "APPROACH":				
				case "APPROACH_COORDINATES":
				case "BACK_OFF":
						this.ship.performFlyToRangeFromDestination();
						break;
				}
				this.setUpHandlers(handlers);
		}

		/* Standard "help the innocent" distress call response. Perhaps
		 * there should be a 'blood in the water' response available
		 * too... */
		this.behaviourRespondToDistressCall = function()
		{
				var aggressor = this.getParameter("oolite_distressAggressor");
				var sender = this.getParameter("oolite_distressSender");
				if (sender.bounty > aggressor.bounty)
				{
						var tmp = sender;
						sender = aggressor;
						aggressor = tmp;
				}
				if (aggressor.position.distanceTo(this.ship) < this.ship.scannerRange)
				{
						this.ship.target = aggressor;
						this.ship.performAttack();
						this.reconsiderNow();
						this.communicate("oolite_distressResponseAggressor",aggressor.displayName);
				}
				else
				{ // we can't actually see what's attacking the sender yet
						this.ship.destination = sender.position;
						this.ship.desiredRange = 1000+sender.collisionRadius+this.ship.collisionRadius;
						this.ship.desiredSpeed = 7 * this.ship.maxSpeed; // use injectors if possible
						this.ship.performFlyToRangeFromDestination();
						// and when we next reconsider, hopefully the aggressor will be on the scanner
						this.communicate("oolite_distressResponseSender",sender.displayName);
				}
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
		}

		
		this.behaviourEnterWitchspace = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				var wormhole = this.getParameter("oolite_witchspaceWormhole");
				if (wormhole && wormhole.expiryTime < clock.adjustedSeconds)
				{
						// the wormhole we were trying for has expired
						this.setParameter("oolite_witchspaceWormhole",null);
				}
				else if (wormhole)
				{
						this.ship.destination = wormhole.position;
						this.ship.desiredRange = 0;
						this.ship.desiredSpeed = this.ship.maxSpeed;
						this.ship.performFlyToRangeFromDestination();
						this.setUpHandlers(handlers);
						return;
				}

				var destID = this.getParameter("oolite_witchspaceDestination");
				if (destID == null)
				{
						// look for wormholes out of here
						// no systems in range
						handlers.wormholeSuggested = function(hole)
						{
								this.ship.destination = hole.position;
								this.ship.desiredRange = 0;
								this.ship.desiredSpeed = this.ship.maxSpeed;
								this.ship.performFlyToRangeFromDestination();
								this.setParameter("oolite_witchspaceWormhole",hole);
								// don't reconsider
						}
						handlers.playerWillEnterWitchspace = function()
						{
								var wormhole = this.getParameter("oolite_witchspaceWormhole");
								if (wormhole != null)
								{
										this.ship.enterWormhole(wormhole);
								} 
								else
								{
										this.ship.enterWormhole();
								}
						}
						this.setUpHandlers(handlers);
						return;
				}
				else
				{
						handlers.shipWitchspaceBlocked = function(blocker)
						{
								this.ship.setDestination = blocker.position;
								this.ship.setDesiredRange = 30000;
								this.ship.setDesiredSpeed = this.cruiseSpeed();
								this.ship.performFlyToRangeFromDestination();
								this.setParameter("oolite_witchspaceEntry",null);
								// no reconsidering yet
						}
						// set up the handlers before trying it
						this.setUpHandlers(handlers);
						
						var entry = this.getParameter("oolite_witchspaceEntry");
						// wait for escorts to launch
						if (!this.conditionAllEscortsInFlight())
						{
								this.ship.destination = this.ship.position;
								this.ship.desiredRange = 10000;
								this.ship.desiredSpeed = this.cruiseSpeed();
								if (this.ship.checkCourseToDestination())
								{
										this.ship.destination = this.ship.getSafeCourseToDestination();
								}
								this.ship.performFlyToRangeFromDestination();

						}
						else if (entry != null && entry < clock.seconds)
						{
								// this should work
								var result = this.ship.exitSystem(destID);
								// if it doesn't, we'll get blocked
								if (result)
								{
										this.setParameter("oolite_witchspaceEntry",null);
								}
						}
						else
						{
								if (entry == null)
								{
										this.communicate("oolite_engageWitchspaceDrive");
										this.setParameter("oolite_witchspaceEntry",clock.seconds + 15);
								}
								this.ship.destination = this.ship.position;
								this.ship.desiredRange = 10000;
								this.ship.desiredSpeed = this.cruiseSpeed();
								if (this.ship.checkCourseToDestination())
								{
										this.ship.destination = this.ship.getSafeCourseToDestination();
								}
								this.ship.performFlyToRangeFromDestination();
						}
				}
		}


		this.behaviourEscortMothership = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.responsesAddEscort(handlers);
				this.setUpHandlers(handlers);
				this.ship.desiredRange = 0;
				this.ship.performEscort();
		}


		// Separate behaviour just in case we want to change it later
		// This is the one to catch up with a distant mothership
		this.behaviourRejoinMothership = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.responsesAddEscort(handlers);
				this.setUpHandlers(handlers);
				// to consider: should this behaviour use injectors if
				// possible? so few escorts have them that it's probably not
				// worth it.
				this.ship.desiredRange = 0;
				this.ship.performEscort();
		}

		/* Follow the group leader in a less organised way than escorting them */
		this.behaviourFollowGroupLeader = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				if (!this.ship.group || !this.ship.group.leader)
				{
						this.ship.performIdle();
				}
				else
				{
						this.ship.destination = this.ship.group.leader.position;
						this.ship.desiredRange = 2000+Math.random()*2000;
						this.ship.desiredSpeed = this.ship.maxSpeed;
						this.ship.performFlyToRangeFromDestination();
				}
		}


		this.behaviourOfferToEscort = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				
				var possible = this.getParameter("oolite_scanResultSpecific");
				if (possible == null)
				{
						this.reconsiderNow();
				}
				else
				{
						if (this.ship.offerToEscort(possible))
						{
								// accepted
								this.reconsiderNow();
						}
						// if rejected, wait for next scheduled reconsideration
				}
		}

		this.behaviourSunskim = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.responsesAddScooping(handlers);
				this.setUpHandlers(handlers);
				this.ship.performFlyToRangeFromDestination();
		}

		this.behaviourPayOffPirates = function()
		{
				this.ship.dumpCargo(this.ship.AIScript.oolite_intership.cargodemand);
				this.communicate("oolite_agreeingToDumpCargo");
				delete this.ship.AIScript.oolite_intership.cargodemand;
				this.ship.AIScript.oolite_intership.cargodemandpaid = true;
				this.behaviourFleeCombat();
		}

		this.behaviourLeaveVicinityOfTarget = function()
		{
				if (!this.ship.target)
				{
						this.reconsiderNow();
						return;
				}
				this.ship.destination = this.ship.target.position;
				this.ship.desiredRange = 27500;
				this.ship.desiredSpeed = this.ship.maxSpeed;
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				this.ship.performFlyToRangeFromDestination();
		}

		this.behaviourRobTarget = function()
		{
				var demand = null;
				if (this.ship.group && this.ship.group.leader)
				{
						if (this.ship.group.leader.AIScript.oolite_intership && this.ship.group.leader.AIScript.oolite_intership.cargodemanded)
						{
								demand = this.ship.group.leader.AIScript.oolite_intership.cargodemanded;
						}
				}
				else
				{
						if (this.ship.AIScript.oolite_intership.cargodemanded)
						{
								demand = this.ship.AIScript.oolite_intership.cargodemanded;
						}
				}
				if (demand == null)
				{
						var hascargo = this.ship.target.cargoSpaceUsed;
						// blowing them up probably gets ~10%, so how much we feel
						// confident in demanding depends on how likely patrols
						// are to come along and interfere.
						demand = (hascargo/20)*(8-system.info.government)*(1+Math.random()); 
						// between 5% and 80% of cargo
						demand = Math.ceil(demand); // round it up so there's always at least 1
						demand = 2+(demand%10); //
						/* 
						// since cargo dumping detection uses checkScanner, this doesn't work
						// for any substantial volume of cargo. Consider reinstating if
						// increasing the max-count on checkScanner doesn't break things

						var maxdemand = 0;
						var gc = 1;
						if (!this.ship.group)
						{
						if (this.ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK")
						{
						maxdemand = this.ship.cargoSpaceAvailable;
						}
						}
						else
						{
						gc = this.ship.group.ships.length;
						for (var i = 0; i < gc ; i++)
						{
						var ship = this.ship.group.ships[i];
						if (ship.equipmentStatus("EQ_FUEL_SCOOPS") == "EQUIPMENT_OK")
						{
						maxdemand += ship.cargoSpaceAvailable;
						}
						}
						}
						if (demand > maxdemand)
						{
						demand = maxdemand; // don't ask for more than we can carry
						}
						while (demand > gc * 5)
						{
						// asking for more than 5TC each probably means there
						// won't be time to pick it all up anyway
						demand = Math.ceil(demand/2);
						}
						if (demand < 2)
						{
						demand = 2;
						}
						*/

						/* Record our demand with the group leader */
						if (this.ship.group && this.ship.group.leader)
						{
								this.ship.group.leader.AIScript.oolite_intership.cargodemanded = demand;
						}
						else
						{
								this.ship.AIScript.oolite_intership.cargodemanded = demand;
						}
						/* Inform the victim of the demand, if possible */
						if (this.ship.target.AIScript && this.ship.target.AIScript.oolite_intership)
						{
								this.ship.target.AIScript.oolite_intership.cargodemand = demand;
						}
						this.communicate("oolite_piracyAlert",this.ship.target.displayName,demand);
						this.ship.requestHelpFromGroup();
						/*				}
											else
											{
											log(this.ship.displayName,"Already asked for "+demand); */
				}
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				this.ship.performAttack();
		}

		this.behaviourGuardTarget = function()
		{
				if (!this.ship.target)
				{
						this.ship.destination = this.ship.position;						
				}
				else
				{
						this.ship.destination = this.ship.target.position;
				}
				this.ship.desiredSpeed = this.cruiseSpeed();
				this.ship.desiredRange = 2500;
		}

		this.behaviourReconsider = function()
		{
				var handlers = {};
				this.responsesAddStandard(handlers);
				this.setUpHandlers(handlers);
				this.reconsiderNow();
		}

		this.behaviourBecomeInactiveThargon = function()
		{
				this.setUpHandlers({});
				this.ship.scanClass = "CLASS_CARGO";
				this.ship.target = null;
				this.ship.clearDefenseTargets();
				if (this.ship.group)
				{
						this.ship.group.removeShip(this.ship);
						this.ship.group = null;
				}
				if (this.ship.escortGroup)
				{
						this.ship.escortGroup.removeShip(this.ship);
				}
				this.ship.desiredSpeed = 0;
				this.ship.performStop();
				var nearby = this.ship.checkScanner();
				for (var i = 0 ; i < nearby.length ; i++)
				{
						var ship = nearby[i];
						if (ship.target == this.ship && !ship.isPlayer && ship.hasHostileTarget)
						{
								ship.target = null;
						}
						ship.removeDefenseTarget(this.ship);
				}
		}

		this.behaviourTumble = function()
		{
				this.setUpHandlers({});
				this.ship.performTumble();
		}

		this.behaviourLandOnPlanet = function()
		{
				this.ship.desiredSpeed = this.ship.maxSpeed / 4;
				this.ship.performLandOnPlanet();
				this.ship.AIScriptWakeTime = 0; // cancel reconsiderations
				this.setUpHandlers({}); // cancel interruptions
				this.communicate("oolite_landingOnPlanet");
		}

		/* Station behaviours: have different standard handler sets */

		this.behaviourStationLaunchDefenseShips = function() 
		{
				if (this.ship.target && this.isAggressive(this.ship.target))
				{
						this.alertCondition = 3;
						this.ship.launchDefenseShip();
						this.ship.requestHelpFromGroup();
				}
				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);
		}

		this.behaviourStationRespondToDistressCall = function() 
		{
				var aggressor = this.getParameter("oolite_distressAggressor");
				var sender = this.getParameter("oolite_distressSender");
				if (sender.bounty > aggressor.bounty)
				{
						var tmp = sender;
						sender = aggressor;
						aggressor = tmp;
				}
				if (aggressor.position.distanceTo(this.ship) < this.ship.scannerRange)
				{
						this.ship.target = aggressor;
						this.ship.alertCondition = 3;
						this.ship.launchDefenseShip();
						this.communicate("oolite_distressResponseAggressor",aggressor.displayName);
						this.ship.requestHelpFromGroup();
				}
				else
				{
						this.communicate("oolite_distressResponseSender",sender.displayName);
				}

				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);
		}
				
		this.behaviourStationLaunchSalvager = function() 
		{
				if (this.alertCondition > 1)
				{
						this.alertCondition--;
				}
				this.ship.launchScavenger();
				
				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);

		}

		this.behaviourStationLaunchMiner = function() 
		{
				if (this.alertCondition > 1)
				{
						this.alertCondition--;
				}
				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);
				if (this.ship.group)
				{
						for (var i = 0 ; i < this.ship.group.ships.length ; i++)
						{
								if (this.ship.group.ships[i].primaryRole == "miner")
								{
										// only one in flight at once
										return;
								}
						}
				}
				this.ship.launchMiner();
		}


		this.behaviourStationLaunchPatrol = function() 
		{
				if (this.alertCondition > 1)
				{
						this.alertCondition--;
				}
				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);

				if (this.ship.group)
				{
						for (var i = 0 ; i < this.ship.group.ships.length ; i++)
						{
								if (this.ship.group.ships[i].primaryRole == this.getParameter("oolite_stationPatrolRole"))
								{
										// only one in flight at once
										return;
								}
						}
				}

				this.ship.launchPatrol();
		}

		this.behaviourStationManageTraffic = function() 
		{
				var handlers = {};
				this.responsesAddStation(handlers);
				this.setUpHandlers(handlers);
				if (this.ship.hasNPCTraffic)
				{
						if (Math.random() < 0.3) 
						{
								var trader = this.ship.launchShipWithRole("trader");
								trader.setCargoType("PLENTIFUL_GOODS");
						}
						if (Math.random() < 0.1)
						{
								this.ship.launchShuttle();
						}
						
						// TODO: integrate with system repopulator rather than just
						// launching ships at random
				}
		}

		/* Missile behaviours: have different standard handler sets */

		this.behaviourMissileInterceptTarget = function()
		{
				var handlers = {};
				this.responsesAddMissile(handlers);
				this.setUpHandlers(handlers);
				if (this.ship.scriptInfo.oolite_missile_proximity)
				{
						this.ship.desiredRange = this.ship.scriptInfo.oolite_missile_proximity;
				}
				else
				{
						this.ship.desiredRange = 25;					
				}

				this.ship.performIntercept();
		}

		this.behaviourMissileInterceptCoordinates = function()
		{
				var handlers = {};
				this.responsesAddMissile(handlers);
				this.setUpHandlers(handlers);
				if (this.ship.scriptInfo.oolite_missile_proximity)
				{
						this.ship.desiredRange = this.ship.scriptInfo.oolite_missile_proximity;
				}
				else
				{
						this.ship.desiredRange = 25;					
				}
				var dest = this.getParameter("oolite_interceptCoordinates");
				if (dest == null)
				{
						return;
				}
				this.ship.destination = dest
				this.ship.desiredSpeed = this.ship.maxSpeed;
				this.ship.performFlyToRangeFromDestination();
				
				// if we have an intercept target, try to restore it
				var oldtarget = this.getParameter("oolite_interceptTarget");
				if (oldtarget && !oldtarget.isCloaked && oldtarget.isInSpace)
				{
						this.ship.target = oldtarget;
				}
		}

		this.behaviourMissileSelfDestruct = function() {
				this.ship.explode();
		}


		/* ****************** Configuration functions ************** */

		/* Configurations. Configurations are set up actions for a behaviour
		 * or behaviours. They can also be used on a fall-through conditional
		 * to set parameters for later tests */

		this.configurationAcquireCombatTarget = function()
		{
				if (this.ship.target && this.allied(this.ship,this.ship.target))
				{
						// don't shoot at allies even if they have ended up as a target...
						this.ship.removeDefenseTarget(this.ship.target);
						this.ship.target = null;
				}
				if (this.ship.target && this.ship.target.scanClass == "CLASS_CARGO")
				{
						this.ship.target = null;
				}
				/* Iff the ship does not currently have a target, select a new one
				 * from the defense target list. */
				if (this.ship.target && this.ship.target.isInSpace)
				{
						return;
				}
				var dts = this.ship.defenseTargets
				for (var i = 0; i < dts.length ; i++)
				{
						if (dts[i].position.distanceTo(this.ship) < this.ship.scannerRange)
						{
								this.ship.target = dts[0];
								return;
						}
				}
				if (this.ship.group != null)
				{
						for (var i = 0 ; i < this.ship.group.length ; i++)
						{
								if (this.ship.group.ships[i] != this.ship)
								{
										if (this.ship.group.ships[i].target && this.isFighting(this.ship.group.ships[i]) && this.ship.group.ships[i].target.position.distanceTo(this.ship) < this.ship.scannerRange)
										{
												this.ship.target = this.ship.group.ships[i].target;
												return;
										}
								}
						}
				}
				if (this.ship.escortGroup != null)
				{
						for (var i = 0 ; i < this.ship.escortGroup.length ; i++)
						{
								if (this.ship.escortGroup.ships[i] != this.ship)
								{
										if (this.ship.escortGroup.ships[i].target && this.isFighting(this.ship.escortGroup.ships[i]) && this.ship.escortGroup.ships[i].target.position.distanceTo(this.ship) < this.ship.scannerRange)
										{
												this.ship.target = this.ship.escortGroup.ships[i].target;
												return;
										}
								}
						}
				}
		}

		// TODO: reuse code from AcquireCombatTarget better
		this.configurationAcquireHostileCombatTarget = function()
		{
				if (this.ship.target && this.allied(this.ship,this.ship.target))
				{
						// don't shoot at allies even if they have ended up as a target...
						this.ship.removeDefenseTarget(this.ship.target);
						this.ship.target = null;
				}
				/* Iff the ship does not currently have a target, select a new one
				 * from the defense target list. */
				if (this.ship.target && this.ship.target.isInSpace && this.isAggressive(this.ship.target))
				{
						return;
				}
				var dts = this.ship.defenseTargets
				for (var i = 0; i < dts.length ; i++)
				{
						if (dts[i].position.distanceTo(this.ship) < this.ship.scannerRange && this.isAggressive(dts[i]))
						{
								this.ship.target = dts[0];
								return;
						}
				}
				if (this.ship.group != null)
				{
						for (var i = 0 ; i < this.ship.group.length ; i++)
						{
								if (this.ship.group.ships[i] != this.ship)
								{
										if (this.ship.group.ships[i].target && this.isFighting(this.ship.group.ships[i]) && this.ship.group.ships[i].target.position.distanceTo(this.ship) < this.ship.scannerRange && this.isAggressive(this.ship.group.ships[i].target))
										{
												this.ship.target = this.ship.group.ships[i].target;
												return;
										}
								}
						}
				}
				if (this.ship.escortGroup != null)
				{
						for (var i = 0 ; i < this.ship.escortGroup.length ; i++)
						{
								if (this.ship.escortGroup.ships[i] != this.ship)
								{
										if (this.ship.escortGroup.ships[i].target && this.isFighting(this.ship.escortGroup.ships[i]) && this.ship.escortGroup.ships[i].target.position.distanceTo(this.ship) < this.ship.scannerRange && this.isAggressive(this.ship.escortGroup.ships[i].target))
										{
												this.ship.target = this.ship.escortGroup.ships[i].target;
												return;
										}
								}
						}
				}
		}


		this.configurationAcquireOffensiveEscortTarget = function()
		{
				if (this.ship.group && this.ship.group.leader && this.ship.group.leader.target && this.ship.group.leader.hasHostileTarget)
				{
						if (this.ship.position.distanceTo(this.ship.group.leader.target) < this.ship.scannerRange)
						{
								this.ship.target = this.ship.group.leader.target;
								this.ship.addDefenseTarget(this.ship.target);
						}
				}
		}

		this.configurationAcquireDefensiveEscortTarget = function()
		{
				if (this.ship.group && this.ship.group.leader)
				{
						var leader = this.ship.group.leader;
						if (leader.target && leader.target.target == leader && this.isFighting(leader) && leader.target.position.distanceTo(this.ship) < this.ship.scannerRange)
						{
								this.ship.target = leader.target;
						}
						else
						{
								var dts = leader.defenseTargets;
								for (var i = 0 ; i < dts.length ; i++)
								{
										if (dts[i].target == leader && this.isAggressive(dts[i]) && dts[i].position.distanceTo(this.ship) < this.ship.scannerRange)
										{
												this.ship.target = dts[i];
										}
								}
						}
				}
		}

		this.configurationCheckScanner = function()
		{
				this.setParameter("oolite_scanResults",this.ship.checkScanner());
				this.setParameter("oolite_scanResultSpecific",null);
		}

		this.configurationAcquireScannedTarget = function()
		{
				this.ship.target = this.getParameter("oolite_scanResultSpecific");
		}

		this.configurationSelectShuttleDestination = function()
		{
				var possibles = system.planets.concat(system.stations);
				var destinations1 = [];
				var destinations2 = [];
				for (var i = 0; i < possibles.length ; i++)
				{
						var possible = possibles[i];
						// travel at least a little way
						var distance = possible.position.distanceTo(this.ship);
						if (distance > possible.collisionRadius + 10000)
						{
								// must be friendly destination and not moving too fast
								if (possible.isPlanet || this.friendlyStation(possible) || possible.maxSpeed > this.ship.maxSpeed / 5)
								{
										if (distance > system.mainPlanet.radius * 5)
										{
												destinations2.push(possible);
										}
										else
										{
												destinations1.push(possible);
										}
								}
						}
				}
				// no nearby destinations
				if (destinations1.length == 0)
				{
						destinations1 = destinations2;
				}
				// no destinations
				if (destinations1.length == 0)
				{
						return;
				}
				var destination = destinations1[Math.floor(Math.random()*destinations1.length)];
				if (destination.isPlanet)
				{
						this.setParameter("oolite_selectedPlanet",destination);
						this.setParameter("oolite_selectedStation",null);
				}
				else
				{
						this.setParameter("oolite_selectedStation",destination);
						this.setParameter("oolite_selectedPlanet",null);
				}
		}

		this.configurationSelectRandomTradeStation = function()
		{
				var stations = system.stations;
				var threshold = 1E16;
				var chosenStation = null;
				if (this.ship.bounty == 0)
				{
						if (Math.random() < 0.9 && this.friendlyStation(system.mainStation))
						{
								this.setParameter("oolite_selectedStation",system.mainStation);
								return;
						}
				} 
				else if (this.ship.bounty <= 50)
				{
						if (Math.random() < 0.5 && this.friendlyStation(system.mainStation))
						{
								this.setParameter("oolite_selectedStation",system.mainStation);
								return;
						}
				}
				var friendlies = 0;
				for (var i = 0 ; i < stations.length ; i++)
				{
						var station = stations[i];
						if (this.friendlyStation(station))
						{
								friendlies++;
								if (Math.random() < 1/friendlies)
								{
										chosenStation = station;
								}
						}
				}
				this.setParameter("oolite_selectedStation",system.mainStation);
				this.communicate("oolite_selectedStation",system.mainStation.displayName);
		}


		this.configurationSetDestinationToWitchpoint = function()
		{
				this.ship.destination = new Vector3D(0,0,0);
				this.ship.desiredRange = 10000;
				this.ship.desiredSpeed = this.cruiseSpeed();
		}

		this.configurationSetDestinationToMainPlanet = function()
		{
				this.ship.destination = system.mainPlanet.position;
				this.ship.desiredRange = system.mainPlanet.radius * 3;
				this.ship.desiredSpeed = this.cruiseSpeed();
		}

		this.configurationSetDestinationToMainStation = function()
		{
				this.ship.destination = system.mainStation.position;
				this.ship.desiredRange = this.ship.scannerRange/2;

				this.ship.desiredSpeed = this.cruiseSpeed();
		}

		this.configurationSetDestinationToSelectedStation = function()
		{
				var station = this.getParameter("oolite_selectedStation");
				if (station)
				{
						this.ship.destination = station.position;
						this.ship.desiredRange = this.ship.scannerRange/2;
						this.ship.desiredSpeed = this.cruiseSpeed();
				}
		}

		this.configurationSetDestinationToSelectedPlanet = function()
		{
				var planet = this.getParameter("oolite_selectedPlanet");
				if (planet)
				{
						this.ship.destination = planet.position;
						this.ship.desiredRange = planet.radius+100;
						this.ship.desiredSpeed = this.cruiseSpeed();
				}
		}


		this.configurationSetDestinationToPirateLurk = function()
		{
				var lurk = this.getParameter("oolite_pirateLurk");
				if (lurk != null)
				{
						this.ship.destination = lurk;
				}
				else
				{
						var code = "WITCHPOINT";
						var p = this.ship.position;
						// if already on a lane, stay on it
						if (p.z < system.mainPlanet.position.z && ((p.x * p.x) + (p.y * p.y)) < system.mainPlanet.radius * 3)
						{
								lurk = p;
						}
						else if (p.subtract(system.mainPlanet).dot(p.subtract(system.sun)) < -0.9)
						{
								lurk = p;
						}
						else if (p.dot(system.sun.position) > 0.9)
						{
								lurk = p;
						}
						else // not on a lane, so pick somewhere at random
						{
								var choice = Math.random();
								if (choice < 0.8)
								{
										code = "LANE_WP";
								}
								else
								{
										code = "LANE_PS";
								}
								// code = "LANE_WS"? "WITCHPOINT"? 
								// what about other locations in less policed systems?
								lurk = system.locationFromCode(code);
						}
						this.setParameter("oolite_pirateLurk",lurk);
				}
				this.ship.desiredRange = 1000;
				this.ship.desiredSpeed = this.cruiseSpeed();
		}


		this.configurationSetDestinationToSunskimStart = function()
		{
				this.ship.destination = system.sun.position;
				// max sunskim height is sqrt(4/3) radius 
				this.ship.desiredRange = system.sun.radius * 1.125;
				this.ship.desiredSpeed = this.cruiseSpeed();
		}

		this.configurationSetDestinationToSunskimEnd = function()
		{
				var direction = Vector3D.random().cross(this.ship.position.subtract(system.sun.position));
				// 2km parallel to local sun surface for every LY of fuel
				this.ship.destination = this.ship.position.add(direction.multiply(2000*(7-this.ship.fuel)));
				// max sunskim height is sqrt(4/3) radius 
				this.ship.desiredRange = 0;
				this.ship.desiredSpeed = this.ship.maxSpeed;
		}

		this.configurationSetDestinationToNearestFriendlyStation = function()
		{
				var stations = system.stations;
				var threshold = 1E16;
				var chosenStation = null;
				for (var i = 0 ; i < stations.length ; i++)
				{
						var station = stations[i];
						if (this.friendlyStation(station))
						{
								var distance = station.position.distanceTo(this.ship);
								if (distance < threshold)
								{
										threshold = distance;
										chosenStation = station;
								}
						}
				}
				if (chosenStation == null)
				{
						this.ship.destination = this.ship.position;
						this.ship.desiredRange = 0;
				}
				else
				{
						this.ship.destination = chosenStation.position;
						this.ship.desiredRange = 15000;
						this.ship.desiredSpeed = this.cruiseSpeed();
				}
		}


		this.configurationSetDestinationToHomeStation = function()
		{
				var home = this.homeStation();
				if (home != null)
				{
						this.ship.destination = home.position;
						this.ship.desiredRange = 15000;
						this.ship.desiredSpeed = this.cruiseSpeed();
				}
				else
				{
						this.ship.destination = this.ship.position;
						this.ship.desiredRange = 0;
				}
		}


		this.configurationSetDestinationToGroupLeader = function()
		{
				if (!this.ship.group || !this.ship.group.leader)
				{
						this.ship.destination = this.ship.position;
				}
				else
				{
						this.ship.destination = this.ship.group.leader.position;
				}
				this.ship.desiredRange = 2000;
				this.ship.desiredSpeed = this.ship.maxSpeed;
		}

		this.configurationSetWaypoint = function()
		{
				var gen = this.getWaypointGenerator();
				if(gen != null)
				{
						gen.call(this);
						this.configurationSetDestinationToWaypoint();
				}
		}

		this.configurationSetDestinationToWaypoint = function()
		{
				this.ship.destination = this.getParameter("oolite_waypoint");
				this.ship.desiredRange = this.getParameter("oolite_waypointRange");
				this.ship.desiredSpeed = this.cruiseSpeed();
		}


		this.configurationSelectWitchspaceDestination = function()
		{
				if (!this.ship.hasHyperspaceMotor)
				{
						this.setParameter("oolite_witchspaceDestination",null);
						return;
				}
				var preselected = this.getParameter("oolite_witchspaceDestination");
				if (preselected != system.ID && system.info.distanceToSystem(System.infoForSystem(galaxyNumber,preselected)) <= this.ship.fuel)
				{
						// we've already got a destination
						return;
				}
				var possible = system.info.systemsInRange(this.ship.fuel);
				var selected = possible[Math.floor(Math.random()*possible.length)];
				this.setParameter("oolite_witchspaceDestination",selected.systemID);
				this.communicate("oolite_selectedWitchspaceDestination",selected.name);
		}

		this.configurationSetNearbyFriendlyStationForDocking = function()
		{
				var stations = system.stations;
				for (var i = 0 ; i < stations.length ; i++)
				{
						var station = stations[i];
						if (this.friendlyStation(station))
						{
								// this is not a very good check for friendliness, but
								// it will have to do for now
								if (station.position.distanceTo(this.ship) < this.ship.scannerRange)
								{
										this.setParameter("oolite_dockingStation",station)
										return;
								}
						}
				}
		}


		this.configurationSetHomeStationForDocking = function()
		{
				if (this.ship.owner && this.ship.owner.isStation && this.friendlyStation(this.ship.owner))
				{
						this.setParameter("oolite_dockingStation",this.ship.owner)
						return;
				}
		}


		this.configurationSetSelectedStationForDocking = function()
		{
				this.setParameter("oolite_dockingStation",this.getParameter("oolite_selectedStation"));
		}


		this.configurationAppointGroupLeader = function()
		{
				if (this.ship.group && !this.ship.group.leader)
				{
						this.ship.group.leader = this.ship.group.ships[0];
						for (var i = 0 ; i < this.ship.group.ships.length ; i++)
						{
								if (this.ship.group.ships[i].hasHyperspaceMotor)
								{
										// bias towards jump-capable ships
										this.ship.group.leader = this.ship.group.ships[i];
										break;
								}
						}
						var leadrole = this.getParameter("oolite_leaderRole")
						if (leadrole != null)
						{
								this.ship.group.leader.primaryRole = leadrole;
						}
				}
		}

		this.configurationEscortGroupLeader = function()
		{
				if (!this.ship.group || !this.ship.group.leader || this.ship.group.leader == this.ship)
				{
						return;
				}
				if (this.ship.group.leader.escortGroup && this.ship.group.leader.escortGroup.containsShip(this.ship))
				{
						return;
				}
				var escrole = this.getParameter("oolite_escortRole")
				if (escrole != null)
				{
						var oldrole = this.ship.primaryRole;
						this.ship.primaryRole = escrole;
						var accepted = this.ship.offerToEscort(this.ship.group.leader);
						if (!accepted)
						{
								this.ship.primaryRole = oldrole;
						}
				}
				
		}


		this.configurationForgetCargoDemand = function()
		{
				/*				if (this.ship.group && this.ship.group.leader && this.ship.group.leader.AIScript.oolite_intership.cargodemanded)
									{
									delete this.ship.group.leader.AIScript.oolite_intership.cargodemanded;
									} */ // not sure about this, maybe not needed

				if (this.ship.AIScript.oolite_intership.cargodemanded)
				{
						delete this.ship.AIScript.oolite_intership.cargodemanded;
						delete this.ship.AIScript.oolite_intership.cargodemandmet;
						// and make the group lose the cargo count from the last demand
						if (this.ship.group)
						{
								for (var i = 0 ; i < this.ship.group.ships.length ; i++)
								{
										var ship = this.ship.group.ships[i];
										if (ship.AIScript && ship.AIScript.oolite_priorityai)
										{
												ship.AIScript.oolite_priorityai.setParameter("oolite_cargoDropped",0);
										}
								}
						}
				}
		}

		this.configurationStationReduceAlertLevel = function() 
		{
				if (this.ship.alertCondition > 1)
				{
						this.ship.alertCondition--;
				}
		}

		this.configurationStationValidateTarget = function()
		{
				if (this.ship.target)
				{
						if(this.ship.position.distanceTo(this.ship.target) > this.ship.scannerRange)
						{
								// station behaviour does not generally validate target
								this.ship.target = null;
						}
				}
		}

		/* ****************** Response definition functions ************** */

		/* Standard state-machine responses. These set up a set of standard
		 * state machine responses where incoming events will cause reasonable
		 * default behaviour and often force a reconsideration of
		 * priorities. Many behaviours will need to supplement the standard
		 * responses with additional definitions. */

		this.responsesAddStandard = function(handlers) 
		{
				handlers.cascadeWeaponDetected = function(weapon)
				{
						this.ship.clearDefenseTargets();
						this.ship.addDefenseTarget(weapon);
						this.setParameter("oolite_cascadeDetected",weapon.position);
						this.ship.target = weapon;
						this.ship.performFlee();
						this.reconsiderNow();
				};

				handlers.shipAttackedWithMissile = function(missile,whom)
				{
						if (!this.ship.hasHostileTarget && this.getParameter("oolite_flag_sendsDistressCalls"))
						{
								this.ship.broadcastDistressMessage();
						}
						if (this.ship.equipmentStatus("EQ_ECM") == "EQUIPMENT_OK")
						{
								this.ship.fireECM();
								this.ship.addDefenseTarget(missile);
								this.ship.addDefenseTarget(whom);
								// but don't reconsider immediately
						}
						else
						{
								this.ship.addDefenseTarget(missile);
								this.ship.addDefenseTarget(whom);
								var tmp = this.ship.target;
								this.ship.target = whom;
								this.ship.requestHelpFromGroup();
								this.ship.target = tmp;
								this.reconsiderNow();
						}
				};
				
				handlers.shipBeingAttacked = function(whom)
				{
						if (whom.target != this.ship && whom != player.ship)
						{
								// was accidental
								if (this.allied(whom,this.ship))
								{
										this.communicate("oolite_friendlyFire",whom.displayName);
										// ignore it
										return;
								}
								if (Math.random() > 0.1)
								{
										// usually ignore it anyway
										return;
								}
						}
						if (!this.ship.hasHostileTarget && this.getParameter("oolite_flag_sendsDistressCalls"))
						{
								this.ship.broadcastDistressMessage();
						}
						if (this.ship.defenseTargets.indexOf(whom) < 0)
						{
								this.ship.addDefenseTarget(whom);
								this.reconsiderNow();
						}
						else 
						{
								// else we know about this attacker already
								if (this.ship.energy * 4 < this.ship.maxEnergy)
								{
										// but at low energy still reconsider
										this.reconsiderNow();
										this.ship.requestHelpFromGroup();
								}
						}
						if (this.ship.hasHostileTarget)
						{
								if (!this.isAggressive(this.ship.target))
								{
										// if our current target is running away, switch targets
										this.ship.target = whom;
								}
								else if (this.ship.target.target != this.ship)
								{
										// if our current target isn't aiming at us
										if (Math.random() < 0.2)
										{
												// occasionally switch
												this.ship.target = whom;
										}
								}
						}

						if (this.ship.escortGroup != null)
						{
								this.ship.requestHelpFromGroup();
						}
				};
				handlers.shipBeingAttackedUnsuccessfully = function(whom)
				{
						if (!this.ship.hasHostileTarget && this.getParameter("oolite_flag_sendsDistressCalls"))
						{
								this.ship.broadcastDistressMessage();
						}
						if (this.ship.defenseTargets.indexOf(whom) < 0)
						{
								this.ship.addDefenseTarget(whom);
								this.reconsiderNow();
						}
				};
				handlers.shipTargetLost = function(target)
				{
						this.reconsiderNow();
				};
				// overridden for escorts
				handlers.helpRequestReceived = function(ally, enemy)
				{
						this.ship.addDefenseTarget(enemy);
						if (!this.ship.hasHostileTarget)
						{
								this.reconsiderNow();
								return; // not in a combat mode
						}
						if (ally.energy / ally.maxEnergy < this.ship.energy / this.ship.maxEnergy)
						{
								// not in worse shape than ally
								if (this.ship.target.target != ally && this.ship.target != ally.target)
								{
										// not already helping, go for it...
										this.ship.target = enemy;
										this.reconsiderNow();
								}
						}
				}
				handlers.cargoDumpedNearby = function(cargo,ship)
				{
						if (this.getParameter("oolite_flag_watchForCargo"))
						{
								var previously = this.getParameter("oolite_cargoDropped");
								if (previously == null)
								{
										previously = 0;
								}
								previously++;
								this.setParameter("oolite_cargoDropped",previously);
						}
				}
				handlers.approachingPlanetSurface = function()
				{
						if (this.getParameter("oolite_flag_allowPlanetaryLanding"))
						{
								this.ship.desiredSpeed = this.ship.maxSpeed / 4;
								this.ship.performLandOnPlanet();
								this.ship.AIScriptWakeTime = 0; // cancel reconsiderations
								this.setUpHandlers({}); // cancel interruptions
								this.communicate("oolite_landingOnPlanet");
						}
						else
						{
								this.reconsiderNow();
						}
				}
				handlers.shipLaunchedFromStation = function(station)
				{
						// clear the station
						this.ship.destination = station.position;
						this.ship.desiredSpeed = this.cruiseSpeed();
						this.ship.desiredRange = 15000;
						this.ship.performFlyToRangeFromDestination();
				}
				handlers.shipWillEnterWormhole = function()
				{
						this.setUpHandlers({});
				}
				handlers.shipExitedWormhole = function()
				{
						this.ship.AIScript.oolite_intership = {};
						//						this.reconsiderNow();
				}

				handlers.distressMessageReceived = function(aggressor, sender)
				{
						if (this.getParameter("oolite_flag_listenForDistressCall") != true)
						{
								return;
						}
						this.setParameter("oolite_distressAggressor",aggressor);
						this.setParameter("oolite_distressSender",sender);
						this.setParameter("oolite_distressTimestamp",clock.adjustedSeconds);
						this.reconsiderNow();
				}
				handlers.offenceCommittedNearby = function(attacker, victim)
				{
						if (this.getParameter("oolite_flag_markOffenders")) 
						{
								attacker.setBounty(attacker.bounty | 7,"seen by police");
								this.ship.addDefenseTarget(attacker);
								this.reconsiderNow();
						}
				}
				handlers.playerWillEnterWitchspace = function()
				{
						var wormhole = this.getParameter("oolite_witchspaceWormhole");
						if (wormhole != null)
						{
								this.ship.enterWormhole(wormhole);
						} 
				}
				handlers.wormholeSuggested = function(hole)
				{
						this.setParameter("oolite_witchspaceWormhole",hole);
						this.reconsiderNow();
				}
				// TODO: more event handlers
		}

		/* Additional handlers for use while docking */
		this.responsesAddDocking = function(handlers) 
		{
				handlers.stationWithdrewDockingClearance = function()
				{
						this.setParameter("oolite_dockingStation",null);
						this.reconsiderNow();
				};
				
				handlers.shipAchievedDesiredRange = function()
				{
						var message = this.ship.dockingInstructions.ai_message;
						if (message == "APPROACH" || message == "BACK_OFF" || message == "APPROACH_COORDINATES")
						{
								this.reconsiderNow();
						}
				};
		}

		/* Override of standard handlers for use while escorting */
		this.responsesAddEscort = function(handlers) 
		{
				handlers.helpRequestReceived = function(ally, enemy)
				{
						// always help the leader
						if (ally == this.ship.group.leader)
						{
								if (!this.ship.target || this.ship.target.target != ally)
								{
										this.ship.target = enemy;
										this.reconsiderNow();
										return;
								}
						}
						this.ship.addDefenseTarget(enemy);
						if (!this.ship.hasHostileTarget)
						{
								this.reconsiderNow();
								return; // not in a combat mode
						}
						if (ally.energy / ally.maxEnergy < this.ship.energy / this.ship.maxEnergy)
						{
								// not in worse shape than ally
								if (this.ship.target.target != ally && this.ship.target != ally.target)
								{
										// not already helping, go for it...
										this.ship.target = enemy;
										this.reconsiderNow();
								}
						}
				}
				handlers.escortDock = function()
				{
						this.reconsiderNow();
				}

		}

		/* Additional handlers for scooping */
		this.responsesAddScooping = function(handlers)
		{
				handlers.shipAchievedDesiredRange = function()
				{
						this.reconsiderNow();
				}
				handlers.shipScoopedFuel = function()
				{
						if (this.ship.fuel == 7)
						{
								this.reconsiderNow();
						}
				}
		}

		// shorter list than before
		this.responsesAddStation = function(handlers) 
		{
				handlers.cascadeWeaponDetected = function(weapon)
				{
						this.ship.alertCondition = 3;
						this.reconsiderNow();
				};

				handlers.shipAttackedWithMissile = function(missile,whom)
				{
						this.ship.alertCondition = 3;
						if (this.ship.equipmentStatus("EQ_ECM") == "EQUIPMENT_OK")
						{
								this.ship.fireECM();
								this.ship.addDefenseTarget(missile);
								this.ship.addDefenseTarget(whom);
								// but don't reconsider immediately
						}
						else
						{
								this.ship.addDefenseTarget(missile);
								this.ship.addDefenseTarget(whom);
								var tmp = this.ship.target;
								this.ship.target = whom;
								this.ship.requestHelpFromGroup();
								this.ship.target = tmp;
								this.reconsiderNow();
						}
				};
				
				handlers.shipBeingAttacked = function(whom)
				{
						if (whom.target != this.ship && whom != player.ship)
						{
								// was accidental
								if (this.allied(whom,this.ship))
								{
										this.communicate("oolite_friendlyFire",whom.displayName);
										// ignore it
										return;
								}
								if (Math.random() > 0.1)
								{
										// usually ignore it anyway
										return;
								}
						}
						this.ship.alertCondition = 3;
						if (this.ship.defenseTargets.indexOf(whom) < 0)
						{
								this.ship.addDefenseTarget(whom);
								this.reconsiderNow();
						}
						else 
						{
								// else we know about this attacker already
								if (this.ship.energy * 4 < this.ship.maxEnergy)
								{
										// but at low energy still reconsider
										this.reconsiderNow();
										this.ship.requestHelpFromGroup();
								}
						}
						if (this.ship.hasHostileTarget)
						{
								if (!this.isAggressive(this.ship.target))
								{
										// if our current target is running away, switch targets
										this.ship.target = whom;
								}
								else if (this.ship.target.target != this.ship)
								{
										// if our current target isn't aiming at us
										if (Math.random() < 0.2)
										{
												// occasionally switch
												this.ship.target = whom;
										}
								}
						}

				};

				handlers.shipTargetLost = function(target)
				{
						this.reconsiderNow();
				};

				handlers.helpRequestReceived = function(ally, enemy)
				{
						this.ship.addDefenseTarget(enemy);
						if (!this.ship.alertCondition == 3)
						{
								this.ship.target = enemy;
								this.reconsiderNow();
								return; // not in a combat mode
						}
						this.ship.target = enemy;
				}

				handlers.distressMessageReceived = function(aggressor, sender)
				{
						if (this.getParameter("oolite_flag_listenForDistressCall") != true)
						{
								return;
						}
						this.setParameter("oolite_distressAggressor",aggressor);
						this.setParameter("oolite_distressSender",sender);
						this.setParameter("oolite_distressTimestamp",clock.adjustedSeconds);
						this.reconsiderNow();
				}
				handlers.offenceCommittedNearby = function(attacker, victim)
				{
						if (this.getParameter("oolite_flag_markOffenders")) 
						{
								attacker.setBounty(attacker.bounty | 7,"seen by police");
								this.ship.addDefenseTarget(attacker);
								if (this.ship.alertCondition < 3)
								{
										this.ship.alertCondition = 3;
										this.ship.target = attacker;
								}
								this.reconsiderNow();
						}
				}
		}

		
		this.responsesAddMissile = function(handlers) {
				handlers.shipHitByECM = function()
				{
						if (this.ship.scriptInfo.oolite_missile_ecmResponse)
						{
								var fn = this.ship.scriptInfo.oolite_missile_ecmResponse;
								if (this.ship.AIScript[fn])
								{
										this.ship.AIScript[fn]();
										this.reconsiderNow();
										return;
								}
								if (this.ship.script[fn])
								{
										this.ship.script[fn]();
										this.reconsiderNow();
										return;
								}
						}

						/* This section for the hardheads should be an ECM
						 * response function, and that is used in the default
						 * shipdata.plist, but for compatibility with older OXPs
						 * it's also hardcoded here for now.
						 *
						 * OXPs wanting to overrule this for hardheads can set a
						 * response function to do so.
						 */
						if (this.ship.primaryRole == "EQ_HARDENED_MISSILE")
						{
								if (Math.random() < 0.1) //10% chance per pulse
								{
										if (Math.random() < 0.5)
										{
												// 50% chance responds by detonation
												this.ship.AIScript.shipAchievedDesiredRange();
												return;
										}
										// otherwise explode as normal below
								}
								else // 90% chance unaffected
								{
										return;
								}
						}

						this.ship.explode();
				}
				handlers.shipTargetCloaked = function()
				{
						this.setParameter("oolite_interceptCoordinates",this.ship.target.position);
						this.setParameter("oolite_interceptTarget",this.ship.target);
						// stops performIntercept sending AchievedDesiredRange
						this.ship.performIdle();
				}
				handlers.shipTargetLost = function()
				{
						this.reconsiderNow();
				}
				handlers.shipAchievedDesiredRange = function()
				{
						if (this.ship.scriptInfo.oolite_missile_detonation)
						{
								var fn = this.ship.scriptInfo.oolite_missile_detonation;
								if (this.ship.AIScript[fn])
								{
										this.ship.AIScript[fn]();
										this.reconsiderNow();
										return;
								}
								if (this.ship.script[fn])
								{
										this.ship.script[fn]();
										this.reconsiderNow();
										return;
								}
						}
						/* Defaults to standard missile settings, in case they're
						 * not specified in scriptInfo */
						var blastpower = 170;
						var blastradius = 32.5;
						var blastshaping = 0.25;
						if (this.ship.scriptInfo.oolite_missile_blastPower)
						{
								blastpower = this.ship.scriptInfo.oolite_missile_blastPower;
						}
						if (this.ship.scriptInfo.oolite_missile_blastRadius)
						{
								blastradius = this.ship.scriptInfo.oolite_missile_blastRadius;
						}
						if (this.ship.scriptInfo.oolite_missile_blastShaping)
						{
								blastshaping = this.ship.scriptInfo.oolite_missile_blastShaping;
						}
						this.ship.dealEnergyDamage(blastpower,blastradius,blastshaping);
						this.ship.explode();
				}
		}


		/* ******************* Waypoint generators *********************** */
		
		/* Waypoint generators. When these are called, they should set up
		 * the next waypoint for the ship. Ideally ships should either
		 * reach that waypoint or formally give up on it before asking for
		 * the next one, but the generator shouldn't assume that unless
		 * it's one written specifically for a particular AI. */

		this.waypointsSpacelanePatrol = function()
		{
				var p = this.ship.position;
				var choice = "";
				if (p.magnitude() < 10000)
				{
						// near witchpoint
						if (Math.random() < 0.9)
						{ 
								// mostly return to planet
								choice = "PLANET";
						}
						else
						{
								choice = "SUN";
						}
				}
				else if (p.distanceTo(system.mainPlanet) < system.mainPlanet.radius * 2)
				{
						// near planet
						if (Math.random() < 0.75)
						{ 
								// mostly go to witchpoint
								choice = "WITCHPOINT";
						}
						else
						{
								choice = "SUN";
						}
				}
				else if (p.distanceTo(system.sun) < system.sun.radius * 3)
				{
						// near sun
						if (Math.random() < 0.9)
						{ 
								// mostly return to planet
								choice = "PLANET";
						}
						else
						{
								choice = "SUN";
						}
				}
				else if (p.z < system.mainPlanet.position.z && ((p.x * p.x) + (p.y * p.y)) < system.mainPlanet.radius * 3)
				{
						// on lane 1
						if (Math.random() < 0.5)
						{
								choice = "PLANET";
						}
						else
						{
								choice = "WITCHPOINT";
						}
				}
				else if (p.subtract(system.mainPlanet).dot(p.subtract(system.sun)) < -0.9)
				{
						// on lane 2
						if (Math.random() < 0.5)
						{
								choice = "PLANET";
						}
						else
						{
								choice = "SUN";
						}
				}
				else if (p.dot(system.sun.position) > 0.9)
				{
						// on lane 3
						if (Math.random() < 0.5)
						{
								choice = "WITCHPOINT";
						}
						else
						{
								choice = "SUN";
						}
				}
				else
				{
						// we're not on any lane. Return to the planet
						choice = "PLANET";
				}
				// having chosen, now set up the next stop on the patrol
				switch (choice) {
				case "WITCHPOINT":
						this.setParameter("oolite_waypoint",new Vector3D(0,0,0));
						this.setParameter("oolite_waypointRange",7500);
						break;
				case "PLANET":
						this.setParameter("oolite_waypoint",system.mainPlanet.position);
						this.setParameter("oolite_waypointRange",system.mainPlanet.radius*2);
						break;
				case "SUN":
						this.setParameter("oolite_waypoint",system.sun.position);
						this.setParameter("oolite_waypointRange",system.sun.radius*2.5);
						break;
				}

		}


		this.waypointsStationPatrol = function()
		{
				var station = null;
				if (this.ship.group)
				{
						station = this.ship.group.leader;
				}
				if (!station)
				{
						station = system.mainStation;
						if (!station)
						{
								this.setParameter("oolite_waypoint",new Vector3D(0,0,0));
								this.setParameter("oolite_waypointRange",7500);
								return;
						}
				}
				var z = station.vectorForward;
				var tmp = new Vector3D(0,1,0);
				if (system.sun)
				{
						tmp = z.cross(system.sun.position.direction());
				}
				var x = z.cross(tmp);
				var y = z.cross(x);
				// x and y now consistent vectors relative to a rotating station

				var waypoints = [
						station.position.add(x.multiply(25000)),
						station.position.add(y.multiply(25000)),
						station.position.add(x.multiply(-25000)),
						station.position.add(y.multiply(-25000))
				];
				
				var waypoint = waypoints[0];
				for (var i=0;i<=3;i++)
				{
						if (this.ship.position.distanceTo(waypoints[i]) < 500)
						{
								waypoint = waypoints[(i+1)%4];
								break;
						}
				}
				this.setParameter("oolite_waypoint",waypoint);
				this.setParameter("oolite_waypointRange",100);

		}


}; // end object constructor


/* Object prototype */
AILib.prototype.constructor = AILib;
AILib.prototype.name = this.name;
