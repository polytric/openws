#!/usr/bin/env node

const parseInput = require('./parse-input')
const buildRequest = require('./build-request')
const prepareOutput = require('./prepare-output')
const loadSpec = require('./load-spec')
const buildIr = require('./build-ir')
const dispatchBuildPlan = require('./build-plan')
const executePlan = require('./execute-plan')


const Pipeline = [
    parseInput,
    buildRequest,
    prepareOutput,
    loadSpec,
    buildIr,
    dispatchBuildPlan,
    executePlan,
]

function main() {
    return Pipeline.reduce((acc, step) => {
        return step(acc)
    }, { argv: process.argv })
}

console.log(JSON.stringify(main(), null, 2))