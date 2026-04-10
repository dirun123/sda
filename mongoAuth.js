const mongoose = require('mongoose');
const { initAuthCreds, BufferJSON, proto } = require('sandes-baileys-v2');

const authSchema = new mongoose.Schema({
    _id: String,
    creds: Object
});
const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema);

const useMongoDBAuthState = async (collectionName) => {
    const removeId = (data, id) => {
        try {
            return {
                _id: id,
                creds: JSON.parse(JSON.stringify(data, BufferJSON.replacer))
            };
        } catch (error) {
            return null;
        }
    };

    const readData = async (id) => {
        try {
            const data = await Auth.findById(id);
            if (data && data.creds) {
                return JSON.parse(JSON.stringify(data.creds), BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            return null;
        }
    };

    const writeData = async (data, id) => {
        try {
            await Auth.findByIdAndUpdate(
                id,
                removeId(data, id),
                { upsert: true, returnDocument: 'after' }
            );
        } catch (error) {
            console.error('Error saving data:', error);
        }
    };

    const removeData = async (id) => {
        try {
            await Auth.findByIdAndDelete(id);
        } catch (error) {
            console.error('Error removing data:', error);
        }
    };

    const creds = await readData(collectionName) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${collectionName}-${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${collectionName}-${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, collectionName);
        }
    };
};

module.exports = { useMongoDBAuthState };
