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
    Layout,
    getFlipperLib,
} from 'flipper-plugin';
import { CoffeeOutlined } from '@ant-design/icons';
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

    function makeEmptyEntry() {
        return {
            preferences: {},
            changesList: [],
        };
    }

    function updateSharedPreferences(update: { name: string; preferences: any }) {
        if (selectedPreferences.get() == null) {
            selectedPreferences.set(update.name);
        }
        sharedPreferences.update((draft) => {
            const entry = draft[update.name] || makeEmptyEntry();
            entry.preferences = update.preferences;
            draft[update.name] = entry;
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
            }
        }
    }

    client.onMessage('sharedPreferencesChange', (change) =>
        sharedPreferences.update((draft) => {
            const entry = draft[change.preferences] || makeEmptyEntry();
            if (change.deleted) {
                delete entry.preferences[change.name];
            } else {
                // event store is append-only
                if (entry.preferences[change.name] == undefined) {
                    entry.preferences[change.name] = [];

                }
                entry.preferences[change.name] = (entry.preferences[change.name] as any[]).concat(change.value);
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

// get the value in the specified path of a json object
// e.g. path: ['a', 'b', 'c'] will return jsonObj['a']['b']['c']
// e.g. path: ['a', 0, 'c'] will return jsonObj['a'][0]['c']
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
        return (
            <Layout.Horizontal center grow>
                <Layout.Container center grow gap>
                    <CoffeeOutlined />
                    <Text type="secondary">
                        Waiting for data
                    </Text>
                </Layout.Container>
            </Layout.Horizontal>
        );
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
                <Select
                    options={themeOptions.reduce((obj, item) => {
                        obj[item] = item;
                        return obj;
                    }, {} as Record<string, string>)}
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
