import blossom from 'edmonds-blossom-fixed';
import { Match } from './Match.js';
import { shuffle } from './Shuffle.js';

interface Player {
    id: string | number,
    score: number,
    pairedUpDown?: boolean,
    receivedBye? : boolean,
    avoid?: Array<string | number>,
    seating?: Array<-1 | 1>,
    rating?: number | null
}

export function Swiss(players: Player[], round: number, rated: boolean = false, seating: boolean = false) : Match[] {
    const matches = [];
    let playerArray = [];
    if (Array.isArray(players)) {
        playerArray = players;
    } else {
        playerArray = [...new Array(players)].map((_, i) => i + 1);
    }
    if (rated) {
        playerArray.filter(p => !p.hasOwnProperty('rating') || p.rating === null).forEach(p => p.rating = 0);
    }
    if (seating) {
        playerArray.filter(p => !p.hasOwnProperty('seating')).forEach(p => p.seating = []);
    }
    let byePlayer = null;
    if (playerArray.length % 2 === 1) {
        // TODO Is it required to handle cases where all players already received a bye?
        byePlayer = playerArray.filter((p) => !p.receivedBye).sort((a,b) => a.score - b.score || a.rating - b.rating)[0];
        playerArray.splice(playerArray.findIndex((p) => p.id === byePlayer.id), 1);
    }
    playerArray = shuffle(playerArray);
    playerArray.forEach((p, i) => p.index = i);
    const scoreGroups = [...new Set(playerArray.map(p => p.score))].sort((a, b) => a - b);
    const scoreSums = [...new Set(scoreGroups.map((s, i, a) => {
        let sums = [];
        for (let j = i; j < a.length; j++) {
            sums.push(s + a[j]);
        }
        return sums;
    }).flat())].sort((a, b) => a - b);
    let pairs = [];
    for (let i = 0; i < playerArray.length; i++) {
        const curr = playerArray[i];
        const next = playerArray.slice(i + 1);
        const sorted = rated ? [...next].sort((a, b) => Math.abs(curr.rating - a.rating) - Math.abs(curr.rating - b.rating)) : [];
        for (let j = 0; j < next.length; j++) {
            const opp = next[j];
            if (curr.hasOwnProperty('avoid') && curr.avoid.includes(opp.id)) {
                continue;
            }
            let wt = 14 * Math.log10(scoreSums.findIndex(s => s === curr.score + opp.score) + 1);
            const scoreGroupDiff = Math.abs(scoreGroups.findIndex(s => s === curr.score) - scoreGroups.findIndex(s => s === opp.score));
            wt += scoreGroupDiff < 2 ? 3 / Math.log10(scoreGroupDiff + 2) : 1 / Math.log10(scoreGroupDiff + 2);
            if (scoreGroupDiff === 1 && curr.hasOwnProperty('pairedUpDown') && curr.pairedUpDown === false && opp.hasOwnProperty('pairedUpDown') && opp.pairedUpDown === false) {
                wt += 1.2;
            }
            if (rated) {
                wt += (Math.log2(sorted.length) - Math.log2(sorted.findIndex(p => p.id === opp.id) + 1)) / 3;
            }
            if (seating) {
                const colorScore = curr.seating.reduce((sum: number, seat: number) => sum + seat, 0);
                const oppScore = opp.seating.reduce((sum: number, seat: number) => sum + seat, 0);
                if (curr.colors.length > 1 && JSON.stringify(curr.seating.slice(-2)) === '[1,1]') {
                     if (JSON.stringify(opp.seating.slice(-2)) === '[1,1]') {
                        continue;
                     } else if (JSON.stringify(opp.seating.slice(-2)) === '[-1,-1]') {
                        wt += 7;
                     } else {
                        wt += 2 / Math.log(4 - Math.abs(oppScore));
                     }
                } else if (curr.colors.length > 1 && JSON.stringify(curr.seating.slice(-2)) === '[-1,-1]') {
                    if (JSON.stringify(opp.seating.slice(-2)) === '[-1,-1]') {
                        continue;
                     } else if (JSON.stringify(opp.seating.slice(-2)) === '[1,1]') {
                        wt += 8;
                     } else {
                        wt += 2 / Math.log(4 - Math.abs(oppScore));
                     } 
                } else {
                    wt += 5 / (4 * Math.log10(6 - Math.abs(colorScore - oppScore)));
                }
            }
            if ((curr.hasOwnProperty('receivedBye') && curr.receivedBye) || (opp.hasOwnProperty('receivedBye') && opp.receivedBye)) {
                wt *= 1.5;
            }
            pairs.push([curr.index, opp.index, wt]);
        }
    }
    const blossomPairs = blossom(pairs, true);
    let playerCopy = [...playerArray];
    let byeArray = [];
    let match = 1;
    do {
        const indexA = playerCopy[0].index;
        const indexB = blossomPairs[indexA];
        playerCopy.splice(0, 1);
        playerCopy.splice(playerCopy.findIndex(p => p.index === indexB), 1);
        let playerA = playerArray.find(p => p.index === indexA);
        let playerB = playerArray.find(p => p.index === indexB);
        if (seating) {
            const aScore = playerA.seating.reduce((sum: number, seat: number) => sum + seat, 0);
            const bScore = playerB.seating.reduce((sum: number, seat: number) => sum + seat, 0);
            if (
                JSON.stringify(playerB.seating.slice(-2)) === '[-1,-1]' ||
                JSON.stringify(playerA.seating.slice(-2)) === '[1,1]' ||
                (playerB.seating.slice(-1) === -1 && playerA.seating.slice(-1) === 1) ||
                bScore < aScore
            ) {
                [playerA, playerB] = [playerB, playerA];
            }
        }
        matches.push({
            round: round,
            match: match++,
            player1: playerA.id,
            player2: playerB.id
        });
    } while (playerCopy.length > blossomPairs.reduce((sum: number, idx: number) => idx === -1 ? sum + 1 : sum, 0));
    if (byePlayer !== null) {
        matches.push({
            round: round,
            match: match++,
            player1: byePlayer.id,
            player2: null
        });
    }
    return matches;
}
