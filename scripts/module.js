const MODULE_ID = "warhammer-to-dnd";

Hooks.once("socketlib.ready", () => {
  const socket = socketlib.registerModule(MODULE_ID);
  socket.register("resolveDiseaseSave", resolveDiseaseSave);
});

function resolveDiseaseSave({ dc, bonus = 0 } = {}) {
  const roll = new Roll("1d20 + @bonus", { bonus: Number(bonus) || 0 });
  roll.evaluateSync();
  return {
    total: roll.total,
    dc: Number(dc) || 10,
    success: roll.total >= (Number(dc) || 10)
  };
}
