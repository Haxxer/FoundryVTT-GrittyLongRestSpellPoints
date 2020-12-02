Hooks.once("init", () => {
  game.settings.register("slow-healing-long-rest-spell-points", "quickHDRoll", {
		name: "Quick-roll Hit Dice (skip dialog)",
    	hint: "Skip the dialog for rolling hit dice and roll them quickly.",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});
});