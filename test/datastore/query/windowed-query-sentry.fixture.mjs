/*
    The exact event payloads from Sentry issue 7380278134, used by the
    deferred-packet regression test. This is a plain data module (not a *.test
    file) so the node:test runner does not execute it directly.

    The 8th log entry (a second `ids` at position 30 / ~244840, identical to the
    6th) is the internal re-log emitted when _applyWaitingPackets drains the
    deferred packet — it is NOT a separate source call and is therefore omitted.
*/
export const QS = {
    s791: '~244791',
    s840: '~244840',
    s848: '~244848',
    s856: '~244856',
    s864: '~244864',
    s865: '~244865',
};

// prettier-ignore
export const E1_ids = ['StohS7w3QcXJ','StohSAV3thn7','StohSNXuky6g','StohSYIalIiV','StohVAeYd7ho','StohX_DqswlR','Stohhuz2FGz7','StohiwxvXbrc','StohsbpPpRTN','StohvXyR_Quo','StohvZgHxwTN','StohxwkrbBy-','Stohztt0hjZc','Stoi1HJleY4F','Stoi1Y0G7eWN','Stoi5q-qh4yF','Stoi5q38eJC3','Stoi5rkBhPys','Stoi6R1TYkiV','StoiB9bw6Sq7','StoiB9sd8N9Z','StoiCy201-qw','StoiF3zRgMDc','StoiGKQQl6t-','StoiKFNtzQ2F','StoiMymgeafw','StoiOVK9EiKB','StoiOwM8tVS-','StoiQpawYJ3R','StoiRfzB2SJo'];
// prettier-ignore
export const E2_ids = ['StoiSQm-9amN','StoiSjS_kPb7','StoiSxjCCVgs','StoiSzJd3-uc','StoiTIvG4QKV','StoiU8Ske3MV','StoiUhfQhxhR','StoiUj0wL9yg','StoiVZbtWdjJ','StoiVZkRr7p3','StoiWdg1LLqc','StoiWeuZECLF','StoiX1wz8WCZ','StoiXX7wjf77','StoiYGJOHSxZ','StoiZh6ZCVoB','StoiaLTaXHG3','StoiahrtkF1-','StoiatSuIwdF','StoicG6RqT1c','StoicfJLetHk','Stoid3Xk1aJV','StoidYd7f0lJ','Stoiir4jiJN3','StoikclfGD6R','StoiqrxWRVWB','StoizURXE4rs','Stoj-RmiVurg','Stoj2smQMyT3','Stoj91IBTRkR'];
// prettier-ignore
export const E3_ids = ['Stoj97MYtoYo','Stoj9Y5VBgdg','Stoj9mot5Pq-','StojB63rsJ_-','StojCP1_3ceZ','StojCfs2s1Bo','StojCg0Qcs_Z','StojERkYkcA7','StojEiE4FjXk','StojG81U_Tqs','StojGTM3WMbo','StojK8X7nPpN','StojKXfSFNkk','StojKquanF3V','StojLsJebXo3','StojP_Hj1qWJ','StojPppbS7i3','StojRPoxH8W7','StojT5rwUK4J','StojUreHwqJ3','StojVQpWAbAo','StokresN7NR3','StoksBBs6W0F','Stol_8BLwrsk','StolokCVjtGk','Stom9oJvKVUg','StomAko0hF5c','StonC7Fydtag','StonI4TDUhQk','Stot4McWczmk'];
// prettier-ignore
export const E4_removed = ['StohS7w3QcXJ','StoiatSuIwdF','StoiahrtkF1-','StoiaLTaXHG3','StoiZh6ZCVoB','StoiYGJOHSxZ','StoiXX7wjf77','StoiX1wz8WCZ','StoiWeuZECLF','StoiWdg1LLqc','StoiVZkRr7p3','StoiVZbtWdjJ','StoiUj0wL9yg','StoiUhfQhxhR','StoiU8Ske3MV','StoiTIvG4QKV','StoiSzJd3-uc','StoiSxjCCVgs','StoiSjS_kPb7','StoiSQm-9amN','StoiRfzB2SJo','StoiQpawYJ3R','StoiOwM8tVS-','StoiOVK9EiKB','StoiMymgeafw','StoiKFNtzQ2F','StoiGKQQl6t-','StoiF3zRgMDc','StoiCy201-qw','StoiB9sd8N9Z','StoiB9bw6Sq7','Stoi6R1TYkiV','Stoi5rkBhPys','Stoi5q38eJC3','Stoi5q-qh4yF','Stoi1Y0G7eWN','Stoi1HJleY4F','Stohztt0hjZc','StohxwkrbBy-','StohvZgHxwTN','StohvXyR_Quo','StohsbpPpRTN','StohiwxvXbrc','Stohhuz2FGz7','StohX_DqswlR','StohVAeYd7ho','StohSYIalIiV','StohSNXuky6g','StohSAV3thn7'];
// prettier-ignore
export const E5_removed = ['StoicG6RqT1c','StoizURXE4rs','StoiqrxWRVWB','StoikclfGD6R','Stoiir4jiJN3','StoidYd7f0lJ','Stoid3Xk1aJV','StoicfJLetHk'];
// prettier-ignore
export const E6_ids = ['StojUreHwqJ3','StojVQpWAbAo','StokresN7NR3','StoksBBs6W0F','Stol_8BLwrsk','StolokCVjtGk','Stom9oJvKVUg','StomAko0hF5c','StonC7Fydtag','StonI4TDUhQk','Stot4McWczmk','StotU-VI1Z77','StoudZWIm4zB','Stouf0aYZfxc','StoujDeVDbHc','Stp-lJSEEu4-','Stp4ZfZru2NZ','StpSCUt_4caF','StpSEpJKSrqk'];
export const E7_removed = E4_removed.slice().sort();
export const E9_removed = E7_removed.concat(E5_removed);
// prettier-ignore
export const E10_removed = ['StoicG6RqT1c','StoicfJLetHk','Stoid3Xk1aJV','StoidYd7f0lJ','Stoiir4jiJN3','StoikclfGD6R','StoiqrxWRVWB','StoizURXE4rs'];
// prettier-ignore
export const E11_removed = ['Stoj-RmiVurg','StojCP1_3ceZ','StojB63rsJ_-','Stoj9mot5Pq-','Stoj9Y5VBgdg','Stoj97MYtoYo','Stoj91IBTRkR','Stoj2smQMyT3'];
// prettier-ignore
export const E12_removed = ['Stoj-RmiVurg','Stoj2smQMyT3','Stoj91IBTRkR','Stoj97MYtoYo','Stoj9Y5VBgdg','Stoj9mot5Pq-','StojB63rsJ_-','StojCP1_3ceZ'];
// prettier-ignore
export const E13_removed = ['StojCfs2s1Bo','StojKXfSFNkk','StojK8X7nPpN','StojGTM3WMbo','StojG81U_Tqs','StojEiE4FjXk','StojERkYkcA7','StojCg0Qcs_Z'];
// prettier-ignore
export const E14_removed = ['StojCfs2s1Bo','StojCg0Qcs_Z','StojERkYkcA7','StojEiE4FjXk','StojG81U_Tqs','StojGTM3WMbo','StojK8X7nPpN','StojKXfSFNkk'];
export const E15_added = [{ index: 0, id: 'StohQd2G_qPg' }];

// The correct, de-duplicated final result (in query order), expressed as ids
// so it is independent of store-key numbering.
// prettier-ignore
export const EXPECTED_FINAL_IDS = ['StohQd2G_qPg','StojKquanF3V','StojLsJebXo3','StojP_Hj1qWJ','StojPppbS7i3','StojRPoxH8W7','StojT5rwUK4J','StojUreHwqJ3','StojVQpWAbAo','StokresN7NR3','StoksBBs6W0F','Stol_8BLwrsk','StolokCVjtGk','Stom9oJvKVUg','StomAko0hF5c','StonC7Fydtag','StonI4TDUhQk','Stot4McWczmk','StotU-VI1Z77','StoudZWIm4zB','Stouf0aYZfxc','StoujDeVDbHc','Stp-lJSEEu4-','Stp4ZfZru2NZ','StpSCUt_4caF','StpSEpJKSrqk'];
