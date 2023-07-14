/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {
    ManagedTable,
    Text,
    Heading,
    FlexColumn,
    colors,
    FlexRow,
    ManagedDataInspector,
    styled,
    Select,
} from 'flipper';
import {
    PluginClient,
    createState,
    usePlugin,
    useValue,
    getFlipperLib,
} from 'flipper-plugin';
import ReactJson, { ThemeKeys } from 'react-json-view';
import { clone } from 'lodash';

import React, { useState } from 'react';
import { Button, notification } from 'antd';
type SharedPreferencesChangeEvent = {
    preferences: string;
    name: string;
    time: number;
    deleted: boolean;
    value?: any;
};
type SharedPreferences = Record<string, any>;
type SharedPreferencesEntry = {
    preferences: SharedPreferences;
    changesList: Array<SharedPreferencesChangeEvent>;
};

export type SetSharedPreferenceParams = {
    sharedPreferencesName: string;
    preferenceName: string;
    preferenceValue: any;
};
type DeleteSharedPreferenceParams = {
    sharedPreferencesName: string;
    preferenceName: string;
};

type Events = { sharedPreferencesChange: SharedPreferencesChangeEvent };
type Methods = {
    getAllSharedPreferences: (params: {}) => Promise<
        Record<string, SharedPreferences>
    >;
    setSharedPreference: (
        params: SetSharedPreferenceParams,
    ) => Promise<SharedPreferences>;
    deleteSharedPreference: (
        params: DeleteSharedPreferenceParams,
    ) => Promise<SharedPreferences>;
};

export function plugin(client: PluginClient<Events, Methods>) {
    const selectedPreferences = createState<string | null>(null, {
        persist: 'selectedPreferences',
    });
    const setSelectedPreferences = (value: string) =>
        selectedPreferences.set(value);
    const sharedPreferences = createState<Record<string, SharedPreferencesEntry>>(
        {},
        { persist: 'sharedPreferences' },
    );

    function updateSharedPreferences(update: { name: string; preferences: any }) {
        if (selectedPreferences.get() == null) {
            selectedPreferences.set(update.name);
        }
        sharedPreferences.update((draft) => {
            const entry = draft[update.name] || { changesList: [] };
            entry.preferences = update.preferences;
            draft[update.name] = entry;
        });
    }

    async function setSharedPreference(params: SetSharedPreferenceParams) {
        const results = await client.send('setSharedPreference', params);
        updateSharedPreferences({
            name: params.sharedPreferencesName,
            preferences: results,
        });
    }
    async function deleteSharedPreference(params: DeleteSharedPreferenceParams) {
        const results = await client.send('deleteSharedPreference', params);
        updateSharedPreferences({
            name: params.sharedPreferencesName,
            preferences: results,
        });
    }

    async function saveToFile() {
        if (selectedPreferences.get() != null) {
            try {
                const name = selectedPreferences.get() as string;
                await getFlipperLib().exportFile(
                    JSON.stringify(sharedPreferences.get()[name]),
                    {
                        defaultPath: name,
                    },
                );
            } catch (e) {
                notification.error({
                    message: 'Save failed',
                    description: `Could not save shared preferences to file`,
                    duration: 15,
                });
            }
        }
    }
    async function loadFromFile() {
        const file = await getFlipperLib().importFile();
        if (file?.path != undefined) {
            const data = await getFlipperLib().remoteServerContext.fs.readFile(
                file.path,
                { encoding: 'utf-8' },
            );
            const preferences = JSON.parse(data) as SharedPreferencesEntry;
            const name = selectedPreferences.get();
            if (name != null) {
                updateSharedPreferences({
                    name: name,
                    preferences: preferences.preferences,
                });

                for (const key in preferences.preferences) {
                    await client.send('setSharedPreference', {
                        sharedPreferencesName: name,
                        preferenceName: key,
                        preferenceValue: preferences.preferences[key],
                    });
                }
            }
        }
    }

    client.onMessage('sharedPreferencesChange', (change) =>
        sharedPreferences.update((draft) => {
            const entry = draft[change.preferences];
            if (entry == null) {
                return;
            }
            if (change.deleted) {
                delete entry.preferences[change.name];
            } else {
                entry.preferences[change.name] = change.value;
            }
            entry.changesList.unshift(change);
            draft[change.preferences] = entry;
        }),
    );
    client.onConnect(async () => {
        const results = await client.send('getAllSharedPreferences', {});
        Object.entries(results).forEach(([name, prefs]) =>
            updateSharedPreferences({ name: name, preferences: prefs }),
        );
    });

    return {
        selectedPreferences,
        sharedPreferences,
        setSelectedPreferences,
        setSharedPreference,
        deleteSharedPreference,
        saveToFile,
        loadFromFile,
    };
}

const CHANGELOG_COLUMNS = {
    event: { value: 'Event' },
    name: { value: 'Name' },
    value: { value: 'Value' },
};
const CHANGELOG_COLUMN_SIZES = {
    event: '30%',
    name: '30%',
    value: '30%',
};

const UPDATED_LABEL = <Text color={colors.lime}>Updated</Text>;
const DELETED_LABEL = <Text color={colors.cherry}>Deleted</Text>;

const InspectorColumn = styled(FlexColumn)({ flexGrow: 0.2 });
const ChangelogColumn = styled(FlexColumn)({
    flexGrow: 0.8,
    paddingLeft: '16px',
});
const RootColumn = styled(FlexColumn)({
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '16px',
});

const themeOptions: ThemeKeys[] = [
    'apathy',
    'apathy:inverted',
    'ashes',
    'bespin',
    'brewer',
    'bright:inverted',
    'bright',
    'chalk',
    'codeschool',
    'colors',
    'eighties',
    'embers',
    'flat',
    'google',
    'grayscale',
    'grayscale:inverted',
    'greenscreen',
    'harmonic',
    'hopscotch',
    'isotope',
    'marrakesh',
    'mocha',
    'monokai',
    'ocean',
    'paraiso',
    'pop',
    'railscasts',
    'rjv-default',
    'shapeshifter',
    'shapeshifter:inverted',
    'solarized',
    'summerfruit',
    'summerfruit:inverted',
    'threezerotwofour',
    'tomorrow',
    'tube',
    'twilight',
];

function extractValue(jsonObj, path: Array<string>) {
    let value = jsonObj;
    for (let key of path) {
        if (value.hasOwnProperty(key)) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    return value;
}

export function Component() {
    const instance = usePlugin(plugin);
    const selectedPreferences = useValue(instance.selectedPreferences);
    const sharedPreferences = useValue(instance.sharedPreferences);
    const [selectedTheme, setSelectedTheme] = useState(
        localStorage.getItem('selectedTheme') || 'monokai'
    );
    const saveSelectedTheme = (theme) => {
        localStorage.setItem('selectedTheme', theme);
    };
    const updateSelectedTheme = (theme) => {
        saveSelectedTheme(theme);
        setSelectedTheme(theme);
    };

    if (selectedPreferences == null) {
        return null;
    }
    const entry = sharedPreferences[selectedPreferences];
    if (entry == null) {
        return null;
    }

    return (
        <RootColumn grow>
            <Heading>
                <span style={{ marginRight: '16px' }}>Preference File</span>
                <Select
                    options={Object.keys(sharedPreferences)
                        .sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1))
                        .reduce((obj, item) => {
                            obj[item] = item;
                            return obj;
                        }, {} as Record<string, string>)}
                    selected={selectedPreferences}
                    onChange={instance.setSelectedPreferences}
                />
                <span style={{ marginLeft: '16px', marginRight: '16px' }}>Options</span>
                {selectedTheme}
                <Select
                    options={themeOptions}
                    selected={selectedTheme}
                    onChange={updateSelectedTheme}
                />
                <Button size="small" onClick={() => instance.saveToFile()}>
                    Save
                </Button>
                <Button
                    style={{ marginLeft: '8px' }}
                    size="small"
                    onClick={() => instance.loadFromFile()}>
                    Load
                </Button>
            </Heading>

            <FlexRow grow scrollable style={{ overflowX: 'hidden' }}>
                <InspectorColumn>
                    <Heading>Inspector</Heading>
                    <ReactJson src={entry.preferences}
                        theme={selectedTheme}
                        collapseStringsAfterLength={120}
                        onEdit={async (edit) => {
                            const { name, namespace, updated_src } = edit;
                            const updatedNamespace: Array<string> = namespace.concat(name).filter((value) => value !== null);
                            if (updatedNamespace.length >= 1) {
                                const prefs = await instance.setSharedPreference({
                                    sharedPreferencesName: selectedPreferences,
                                    preferenceName: updatedNamespace[0],
                                    preferenceValue: extractValue(updated_src, updatedNamespace.slice(0, 1)),
                                });
                                updateSharedPreferences({ name: selectedPreferences, preferences: prefs });
                            }
                        }}
                        onDelete={async (edit) => {
                            const { name, namespace, updated_src } = edit;
                            const updatedNamespace: Array<string> = namespace.concat(name).filter((value) => value !== null);

                            if (updatedNamespace.length == 1) {
                                // delete the whole key
                                const prefs = await instance.deleteSharedPreference({
                                    sharedPreferencesName: selectedPreferences,
                                    preferenceName: updatedNamespace[0],
                                });
                                updateSharedPreferences({ name: selectedPreferences, preferences: prefs });
                            } else if (updatedNamespace.length > 1) {
                                // replace the select key value
                                const prefs = await instance.setSharedPreference({
                                    sharedPreferencesName: selectedPreferences,
                                    preferenceName: updatedNamespace[0],
                                    preferenceValue: extractValue(updated_src, updatedNamespace.slice(0, 1))
                                });
                                updateSharedPreferences({ name: selectedPreferences, preferences: prefs });
                            }
                        }}
                    />

                </InspectorColumn>
                <ChangelogColumn>
                    <Heading>Changelog</Heading>
                    <ManagedTable
                        columnSizes={CHANGELOG_COLUMN_SIZES}
                        columns={CHANGELOG_COLUMNS}
                        rowLineHeight={26}
                        rows={entry.changesList.map((element, index) => {
                            return {
                                columns: {
                                    event: {
                                        value: element.deleted ? DELETED_LABEL : UPDATED_LABEL,
                                    },
                                    name: { value: element.name },
                                    value: { value: String(element.value) },
                                },
                                key: String(index),
                            };
                        })}
                    />
                </ChangelogColumn>
            </FlexRow>
        </RootColumn>
    );
}
