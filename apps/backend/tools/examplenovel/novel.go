// Package examplenovel is the novel the e2e tests and the local stack rely on: its IDs, name, tags and chapter text are asserted on by apps/backend-e2e.
package examplenovel

import (
	"slices"

	"github.com/google/uuid"

	"github.com/Ponos-OS/smart-novel/apps/backend/internal/devdata"
)

// Novel is the example novel with its chapters, numbered in order.
func Novel() devdata.Novel {
	novel := details
	novel.Chapters = slices.Clone(chapters)
	for index := range novel.Chapters {
		novel.Chapters[index].Number = index + 1
	}

	return novel
}

var details = devdata.Novel{
	NovelDetails: devdata.NovelDetails{
		ID:          uuid.MustParse("c1d31ec2-f478-4648-b90b-d1e53de2a829"),
		Name:        "The Journey Begins",
		Description: "A young hero leaves home to uncover an ancient mystery and shape the fate of the realm.",
		Tags:        []string{"fantasy", "adventure"},
		State:       "ONGOING",
		CoverURL:    "http://s3.localhost:8080/smart-novel/covers/71a3fcd8-937d-4e3d-94de-a643ff515f82.png",
		License:     "CC-BY-4.0",
	},
}

var chapters = []devdata.Chapter{
	{
		ID:    uuid.MustParse("4dd92f16-4743-47b9-960c-6529678e9bc5"),
		Title: "The Beginning",
		Content: `# Chapter 1: The Beginning

In a small village nestled between rolling hills and ancient forests, a young adventurer named Elena discovered an old map hidden in her grandmother's attic. The map was yellowed with age, its edges frayed, but the intricate markings and mysterious symbols captured her imagination immediately.

She scrutinized the men's faces carefully, trying to work out who was lying about the treasure's location. The village elders had always spoken of a legendary artifact, but none had dared to seek it.

As dawn broke over the horizon, Elena made her decision. She would embark on this journey, following the map's cryptic directions into the unknown. Little did she know that this choice would change her life forever.

The path ahead was uncertain, filled with both danger and wonder. But Elena was ready. Her adventure was just beginning.`,
	},
	{
		ID:    uuid.MustParse("4769a024-6267-4abc-a412-5ab0241a8d0e"),
		Title: "The First Challenge",
		Content: `# Chapter 2: The First Challenge

Elena's journey led her deep into the Whispering Woods, a place where few dared to venture. The trees here were ancient, their gnarled branches reaching toward the sky like skeletal fingers. Strange sounds echoed through the forest—whispers that seemed to come from nowhere and everywhere at once.

According to the map, she needed to find the Stone of Wisdom, an ancient marker that would point her toward the next step of her quest. But the forest was vast, and the stone could be anywhere.

As she pushed through the dense undergrowth, Elena encountered her first real challenge: a rickety bridge spanning a deep ravine. The wooden planks creaked ominously with each step, and far below, a river raged with white water fury.

Fear gripped her heart, but she remembered her grandmother's words: "Courage is not the absence of fear, but the triumph over it." Taking a deep breath, Elena stepped onto the bridge and began her careful crossing.

Halfway across, a plank gave way beneath her foot. She stumbled, her heart racing, but managed to catch herself on the rope railing. After what felt like an eternity, she reached the other side, her legs shaking but her spirit unbroken.

The adventure continued, and Elena knew this was only the beginning of the trials she would face.`,
	},
	{
		ID:    uuid.MustParse("a3987a2f-eaa5-4a05-8714-34a110511cba"),
		Title: "Faithful Encounter",
		Content: `# Chapter 3: Faithful Encounter

Beyond the ravine, the Whispering Woods seemed to grow quieter, as if the forest were holding its breath. Elena followed a narrow deer trail until the trees opened into a small clearing washed in pale morning light. At its center stood a stone half-buried in moss, etched with the same spirals and symbols as the map.

“The Stone of Wisdom,” she whispered, hardly daring to believe it.

When her fingers brushed the carving, the air shifted—cooler, heavier. The whispers returned, threading together into something almost like words. Elena pulled the map from her pack and laid it against the stone. For a moment nothing happened. Then the symbols on the map seemed to align with the markings on the rock, and a faint line—like a trail drawn in moonlight—appeared on the parchment, pointing deeper into the forest.

A snap of twigs made her whirl around.

At the edge of the clearing stood a lean, ash-gray dog with bright, watchful eyes. It didn’t bark or growl. It simply looked at her as if it had been waiting. A strip of worn leather hung around its neck, and tied to it was a small metal charm shaped like a compass rose.

Elena crouched slowly, keeping her voice calm. “Are you lost?”

The dog took a cautious step forward, sniffed the air, then trotted straight to the stone. It sat beside it, tail still, gaze fixed on the glowing line on Elena’s map. When Elena moved, the dog rose immediately, matching her as though the decision had already been made.

She hesitated only a moment. In the woods, nothing happened by accident—not the clearing, not the stone, and certainly not this quiet, steady presence. Elena reached out, and the dog allowed her to touch its neck, warm fur under her fingertips.

“Alright,” she murmured, more to herself than to it. “Come with me.”

The dog turned and started down the faint trail as if it knew the way. Elena followed, clutching the map, feeling the forest close around them again. The whispers had not vanished, but they no longer sounded like warnings.

They sounded like guidance.`,
	},
	{
		ID:    uuid.MustParse("038dd3f5-e921-4076-be91-66175ebd1bc3"),
		Title: "Echoes in the Dark",
		Content: `# Chapter 4: Echoes in the Dark

The forest path narrowed until only slivers of light pierced the canopy. Elena walked close behind the ash‑gray dog, whose steady confidence was the only thing keeping her nerves from unraveling. The glowing line on the map pulsed faintly, guiding them deeper into the unknown.

Soon they reached a cavern entrance hidden behind a curtain of hanging vines. Cool air drifted out, carrying with it a low, rhythmic hum—too regular to be wind, too alive to be imagined.

The dog stepped inside without hesitation.

Elena swallowed hard and followed.

Within, the cavern shimmered with veins of crystal embedded in the walls, each resonating softly with the strange hum. As she advanced, the humming grew clearer, resolving into something eerily familiar—whispers, like those she had heard in the woods, but layered, urgent.

At the chamber’s center sat an ancient pedestal. Resting atop it was a smooth, obsidian shard, glowing faintly from within.

The moment Elena stepped closer, the whispers surged, forming a single, unmistakable message:

**“Not all who seek the path may walk it.”**

Her breath caught. The dog stood rigid at her side, hackles raised—not in fear, but in warning.

Elena reached out, hand trembling, unsure whether touching the shard would reveal the answers she sought… or awaken something far more dangerous.

Either way, she knew there was no turning back now.`,
	},
	{
		ID:    uuid.MustParse("6d908673-b125-4729-9da9-4fb907afe2a1"),
		Title: "The Shard",
		Content: `# Chapter 5: The Shard

Elena's fingers closed around the obsidian shard, and the cavern's hum surged into a single sustained note. Light bled from the crystal veins in the walls, painting the chamber in shifting blue.

The dog pressed against her leg, steady despite the rising glow.

For a moment nothing happened. Then the whispers fell silent, replaced by a stillness that felt heavier than the noise before it.

Elena exhaled. Whatever the shard was, it had chosen not to answer — not yet.`,
	},
}
