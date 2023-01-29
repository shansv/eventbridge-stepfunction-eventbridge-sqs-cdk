import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EventBridgeCDKStateMachineEventBridgeSQSStack } from '../lib/eventbridge-stepfunction-eventbridge-sqs-stack';

test('EventBus & StepFunction & EventBus Rule & SQS Stack Creation', () => {
  const app = new cdk.App();
  // WHEN
  const stepFunctionstack = new EventBridgeCDKStateMachineEventBridgeSQSStack(app, 'MyStepFunctionStack');
  // THEN
  const template = Template.fromStack(stepFunctionstack);
  console.log(JSON.stringify(template));

  template.resourceCountIs('AWS::Events::EventBus', 1);
  template.resourceCountIs('AWS::Events::Rule', 2);
  template.resourceCountIs('AWS::SQS::Queue', 2);
  template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
});