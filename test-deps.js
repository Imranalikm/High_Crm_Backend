const { Deposit, Mt5Account, User } = require('./src/models');

async function test() {
  try {
    const deps = await Deposit.findAll({
      include: [
        { model: User, as: 'creator',   attributes: ['id', 'name', 'email'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'email'] },
        { model: Mt5Account, as: 'mt5Account', attributes: ['groupName'] }
      ]
    });
    console.log("DEPOSITS FETCHED:", deps.length);
    console.log(JSON.stringify(deps, null, 2));
  } catch (e) {
    console.error("DB ERROR:", e);
  }
}

test();
