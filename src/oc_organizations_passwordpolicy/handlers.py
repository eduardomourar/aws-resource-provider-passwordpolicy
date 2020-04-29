import logging
import sys
from uuid import uuid4
from typing import Any, Mapping, MutableMapping, Optional
from typing_inspect import is_union_type, get_args
from dataclasses import asdict, dataclass
from botocore.exceptions import ClientError

from cloudformation_cli_python_lib import (
    Action,
    HandlerErrorCode,
    OperationStatus,
    ProgressEvent,
    Resource,
    SessionProxy,
    exceptions,
)

from .models import ResourceHandlerRequest, ResourceModel

# Use this logger to forward log messages to CloudWatch Logs.
LOG = logging.getLogger(__name__)
TYPE_NAME = "OC::Organizations::PasswordPolicy"

resource = Resource(TYPE_NAME, ResourceModel)
test_entrypoint = resource.test_entrypoint

@dataclass
class PasswordPolicy(ResourceModel):
    def __setattr__(self, name: str, value: Any):
        anns = getattr(self, "__annotations__", {})
        type_attr = anns[name]
        if value is not None and type_attr:
            if is_union_type(type_attr):
                type_attr = get_args(type_attr)[0]
            if type_attr.__name__ == 'bool' and (value == 0 or value == 'false'):
                value = False
            elif type(value) is not type_attr:
                value = type_attr(value)
        super().__setattr__(name, value)

    def serialize(self) -> Mapping[str, Any]:
        return {k: v for k, v in asdict(self).items() if (v is not None and k != 'ResourceId' and k != 'ExpirePasswords')}

@resource.handler(Action.CREATE)
def create_handler(
    session: Optional[SessionProxy],
    request: ResourceHandlerRequest,
    callback_context: MutableMapping[str, Any],
) -> ProgressEvent:
    model = PasswordPolicy(**vars(request.desiredResourceState))
    progress: ProgressEvent = ProgressEvent(
        status=OperationStatus.IN_PROGRESS,
        resourceModel=model,
    )
    # try:
    #     if _retrieve_password_policy(session, request.desiredResourceState, request.logicalResourceIdentifier):
    #         raise Exception
    # except Exception:
    #     raise exceptions.AlreadyExists(TYPE_NAME, model.ResourceId or request.logicalResourceIdentifier)
    # except:
    #     pass
    if isinstance(session, SessionProxy):
        model = _upsert_password_policy(session, model, request.logicalResourceIdentifier)
        progress.resourceModel = model
        progress.status = OperationStatus.SUCCESS
    return progress

@resource.handler(Action.UPDATE)
def update_handler(
    session: Optional[SessionProxy],
    request: ResourceHandlerRequest,
    callback_context: MutableMapping[str, Any],
) -> ProgressEvent:
    model = PasswordPolicy(**vars(request.desiredResourceState))
    progress: ProgressEvent = ProgressEvent(
        status=OperationStatus.IN_PROGRESS,
        resourceModel=model,
    )
    _retrieve_password_policy(session, request.desiredResourceState, request.logicalResourceIdentifier)
    if isinstance(session, SessionProxy):
        model = _upsert_password_policy(session, model, model.ResourceId or request.logicalResourceIdentifier)
        progress.resourceModel = model  
        progress.status = OperationStatus.SUCCESS
    return progress

@resource.handler(Action.DELETE)
def delete_handler(
    session: Optional[SessionProxy],
    request: ResourceHandlerRequest,
    callback_context: MutableMapping[str, Any],
) -> ProgressEvent:
    model = request.desiredResourceState
    progress: ProgressEvent = ProgressEvent(
        status=OperationStatus.IN_PROGRESS,
        resourceModel=model,
    )
    progress = read_handler(session, request, callback_context)
    client = session.client('iam')
    client.delete_account_password_policy()
    LOG.info(f"{TYPE_NAME} [{progress.resourceModel.ResourceId}] [{request.logicalResourceIdentifier}] successfully deleted.")
    return progress

@resource.handler(Action.READ)
def read_handler(
    session: Optional[SessionProxy],
    request: ResourceHandlerRequest,
    callback_context: MutableMapping[str, Any],
) -> ProgressEvent:
    model = request.desiredResourceState
    progress: ProgressEvent = ProgressEvent(
        status=OperationStatus.IN_PROGRESS,
        resourceModel=model,
    )
    model = _retrieve_password_policy(session, model, request.logicalResourceIdentifier)
    progress.resourceModel = model
    progress.status = OperationStatus.SUCCESS
    return progress

@resource.handler(Action.LIST)
def list_handler(
    session: Optional[SessionProxy],
    request: ResourceHandlerRequest,
    callback_context: MutableMapping[str, Any],
) -> ProgressEvent:
    progress: ProgressEvent = ProgressEvent(
        status=OperationStatus.IN_PROGRESS,
        resourceModels=[],
    )
    model = _retrieve_password_policy(session, request.desiredResourceState, request.logicalResourceIdentifier)
    progress.resourceModels = [model]
    progress.status = OperationStatus.SUCCESS
    return progress

def _retrieve_password_policy(
    session: SessionProxy,
    model: Mapping[str, Any],
    logical_resource_identifier: Optional[str],
) -> PasswordPolicy:
    try:
        client = session.client('iam')
        response = client.get_account_password_policy()
        merged = {**vars(model), **response['PasswordPolicy']}
        model = PasswordPolicy(**merged)
        if model.ResourceId is None:
            model.ResourceId = logical_resource_identifier
        LOG.info(f"{TYPE_NAME} [{model.ResourceId}] [{logical_resource_identifier}] successfully retrieved.")
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') == 'NoSuchEntity':
            raise exceptions.NotFound(TYPE_NAME, model.ResourceId or logical_resource_identifier)
        else: # raise the original exception
            raise
    return model

def _upsert_password_policy(
    session: SessionProxy,
    model: PasswordPolicy,
    logical_resource_identifier: Optional[str],
) -> PasswordPolicy:
    try:
        client = session.client('iam')
        if model.ResourceId is None:
            model.ResourceId = str(uuid4())
        client.update_account_password_policy(**model.serialize())
        LOG.info(f"{TYPE_NAME} [{model.ResourceId}] [{logical_resource_identifier}] successfully upserted.")
    except TypeError as e:
        raise exceptions.InternalFailure(f"was not expecting type {e}")
    return model
