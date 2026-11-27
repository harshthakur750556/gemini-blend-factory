using System.Collections.Generic;
using UnityEngine;

namespace BlendFactory.SkySanctuary_FantasyRPG
{
    /// <summary>
    /// Compiled Unity Action & Story Node Graph Runner (6 Action nodes, 5 Story nodes).
    /// </summary>
    public class StoryActionGraphRunner : MonoBehaviour
    {
        public AnimeFantasyCharacterController character;
        public string currentStoryNodeId = "story-intro";

        public void AdvanceStory()
        {
            if (string.IsNullOrEmpty(currentStoryNodeId)) return;
            currentStoryNodeId = ExecuteNode(currentStoryNodeId);
        }

        private string ExecuteNode(string nodeId)
        {
            switch (nodeId)
            {
                case "story-intro":
                    Debug.Log("[Aelira (Guild Mage)] The ancient lantern spire is resonating again. Should we channel an emerald ward or survey the courtyard first?");
                    character?.TriggerEmote("Story_Ch1_Intro");
                    return "story-choice";
                case "story-choice":
                    Debug.Log("[Player Decision] Branching Narrative Fork");
                    character?.TriggerEmote("Story_Choice_01");
                    return "story-ward";
                case "story-ward":
                    Debug.Log("[World System] Aelira raises both hands as emerald runes unfurl beneath her boots, shifting the sanctuary into celestial twilight.");
                    character?.TriggerEmote("Event_CelestialSky");
                    return "story-quest";
                case "story-scout":
                    Debug.Log("[Aelira (Guild Mage)] Clear sightlines across the sunlit courtyard. I will mark the eastern ruins on our guild compass.");
                    character?.TriggerEmote("Story_CourtyardRecon");
                    return "story-quest";
                case "story-quest":
                    Debug.Log("[Narrator] Objective logged: Explore the 3D scene in Play Mode or import new Marketplace relics.");
                    character?.TriggerEmote("Quest_RestoreSpire");
                    return "";
                default:
                    return string.Empty;
            }
        }
    }
}
