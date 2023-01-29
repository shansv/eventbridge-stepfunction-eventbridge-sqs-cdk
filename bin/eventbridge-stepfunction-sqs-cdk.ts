#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { EventBridgeCDKStateMachineEventBridgeSQSStack } from '../lib/eventbridge-stepfunction-eventbridge-sqs-stack';

const app = new App();

new EventBridgeCDKStateMachineEventBridgeSQSStack(app, 'EventBridgeCDKStateMachineEventBridgeSQSStack', {});

