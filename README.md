# OC::Organizations::PasswordPolicy

This CloudFormation Resource Provider sets an IAM Password Policy for a target AWS account. Note that IAM password policies are global, and this will be applied to all regions no matter where the CloudFormation stack is deployed to.

## Usage

1. Check the JSON schema describing the resource, [oc-organizations-passwordpolicy.json](./oc-organizations-passwordpolicy.json)
2. Run `npm install --optional`
3. Customize the resource handlers to your needs in [handlers.ts](./src/handlers.ts)
4. Build the project with `npm run build`
5. You can test it locally with SAM CLI (just remember to [assume role with MFA](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetSessionToken.html))
6. Follow the steps on the AWS documentation to submit to the CloudFormation registry: https://docs.aws.amazon.com/cloudformation-cli/latest/userguide/resource-types.html
7. Use [this template](./sample.yml) to deploy a sample password policy resource

> Don't modify [models.ts](./src/models.ts) by hand, any modifications will be overwritten when the `generate` or `package` commands are run.

Keep in mind, during runtime all logs will be delivered to CloudWatch except those used with `debug` method.
