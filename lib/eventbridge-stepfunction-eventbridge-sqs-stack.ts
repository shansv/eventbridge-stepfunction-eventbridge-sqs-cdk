import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from 'path';

export class EventBridgeCDKStateMachineEventBridgeSQSStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Success and failure pass through step
    const succeeded = new sfn.Succeed(this, 'Execution Succeed');
    const fail = new sfn.Fail(this, 'Execution Failed');

    // Defines an AWS Lambda resource
    const executionLambda = new lambda.Function(this, 'stepFunctionExecutionLambda', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '/../src/stepFunctionExecution')),
      handler: 'stepFunctionExecution.handler',
      timeout: cdk.Duration.seconds(900)
    });

    //Task/lambda job to execute the business logic
    const executionFunction = new tasks.LambdaInvoke(this, 'Business Execution Job', {
      lambdaFunction: executionLambda,
      retryOnServiceExceptions: true,
      outputPath: '$.Payload'
    });

    executionFunction.addRetry({ errors: ['Failure Exception'], maxAttempts: 1 });
    executionFunction.addCatch(fail, {
      resultPath: "$.message.errorMessage"});
    
    executionFunction.next(
      new sfn.Choice(this, 'Does execution successfull?')
        .when(sfn.Condition.stringEquals('$.processedInput.transactionStatus', 'completed'), succeeded)
        .otherwise(fail)
    );
  
    const stateMachine = new sfn.StateMachine(this, 'EventBridgeStateMachineEventBridgeSQSCDK', {
      stateMachineName: 'EventBridgeStateMachineEventBridgeSQSCDK',
      definition: executionFunction
    });


    // Grant lambda execution roles
    executionLambda.grantInvoke(stateMachine.role);

    //Create Event Bus, rules and targets

    const stepFunctionEventBus = new events.EventBus(this, "stepFunctionEventBus");

    const  eventRule = new events.Rule(this, 'stepFunctionExecution-rule', {
        eventPattern: {
          source: ["CustomStepEvent"],
          detailType: ["CREATE", "UPDATE", "DELETE"],
        },
        eventBus: stepFunctionEventBus
    });

    // Create Aysnc dlq Queue
    const aysncdlqQueue = new sqs.Queue(this, 'aysncDLQ');
        
    eventRule.addTarget(new targets.SfnStateMachine(stateMachine, {
        deadLetterQueue: aysncdlqQueue, // Optional: add a dead letter queue
        maxEventAge: cdk.Duration.hours(2), // Optional: set the maxEventAge retry policy
        retryAttempts: 3, // Optional: set the max number of retry attempts
    }));

    // Create Failure Queue
    const failureQueue = new sqs.Queue(this, 'Step function Failure Queue');

    const  failedEventRule = new events.Rule(this, 'stepfunctionexecution-failed-event-rule', {
      eventPattern: {
        source: ["aws.states"],
        detailType: ["Step Functions Execution Status Change"],
        detail: {
          status: ["FAILED", "TIMED_OUT", "ABORTED"],
          stateMachineArn: [stateMachine.stateMachineArn]
        }
      }
    });

    failedEventRule.addTarget(new targets.SqsQueue(failureQueue));

    // 👇 Create Outputs
    new cdk.CfnOutput(this, 'Event Custom Bus', {
      value: stepFunctionEventBus.eventBusName,
      description: 'The custom Event Bus Name',
      exportName: 'stepFunctionEventBus',
    });

    new cdk.CfnOutput(this, 'StepFunction', {
      value: stateMachine.stateMachineName,
      description: 'The name of the stepfunction workflow',
      exportName: 'eventBridgestepFunctionName',
    });

    new cdk.CfnOutput(this, 'EventBridge Failure DLQ', {
      value: aysncdlqQueue.queueName,
      description: 'EventBridge Step function Failure innovation DLQ',
      exportName: 'failureDLQSQSName',
    });

    new cdk.CfnOutput(this, 'Step function Failure Events Queue', {
      value: failureQueue.queueName,
      description: 'Step function Failure Events Queue',
      exportName: 'failureEventSQSName',
    });
  }
}
