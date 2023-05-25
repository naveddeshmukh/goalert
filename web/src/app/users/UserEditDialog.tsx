import React, { useState } from 'react'
import { ApolloError, gql, useMutation } from '@apollo/client'
import Spinner from '../loading/components/Spinner'
import FormDialog from '../dialogs/FormDialog'
import { useSessionInfo } from '../util/RequireConfig'
import { FieldError, fieldErrors, nonFieldErrors } from '../util/errutil'
import UserEditForm, { Value } from './UserEditForm'

const updateUserMutation = gql`
  mutation ($input: UpdateUserInput!) {
    updateUser(input: $input)
  }
`

interface UserEditDialogProps {
  userID: string
  role: string
  onClose: () => void
}

function UserEditDialog(props: UserEditDialogProps): JSX.Element {
  const defaultValue: Value = {
    oldPassword: '',
    password: '',
    confirmNewPassword: '',
    isAdmin: props.role === 'admin',
  }

  const {
    ready: isSessionReady,
    userID: currentUserID,
    isAdmin,
  } = useSessionInfo()

  const [value, setValue] = useState(defaultValue)
  const [errors, setErrors] = useState<FieldError[]>([])

  const [editUser, editUserStatus] = useMutation(updateUserMutation, {
    variables: {
      input: {
        id: props.userID,
        role:
          defaultValue.isAdmin !== value.isAdmin
            ? value.isAdmin
              ? 'admin'
              : 'user'
            : null,
        oldPassword: value.oldPassword || null,
        password: value.password || null,
      },
    },
  })

  // Checks if any of the password fields are used. Used to skip any unnecessary updateUserMutation
  function passwordChanged(): boolean {
    return Boolean(
      value.oldPassword || value.password || value.confirmNewPassword,
    )
  }

  // Validates inputs to the newPassword and confirmNewPassword fields
  function handleValidation(): FieldError[] {
    let err: FieldError[] = []
    if (!passwordChanged()) return err
    if (value.password !== value.confirmNewPassword) {
      err = [
        ...err,
        {
          field: 'confirmNewPassword',
          message: 'Passwords do not match',
        } as FieldError,
      ]
    }
    return err
  }

  // wrapper function to handle errors caught while executing useMutation Promises
  function errorHandler(
    caughtError: unknown,
    errorList: FieldError[],
  ): FieldError[] {
    if (caughtError instanceof ApolloError) {
      errorList = [...errorList, ...fieldErrors(caughtError)]
    } else {
      console.error(caughtError)
    }
    return errorList
  }

  // async wrapper function in order to await for useMutation Promises
  async function submitHandler(): Promise<void> {
    let errorList: FieldError[] = []
    errorList = [...errorList, ...handleValidation()]
    if (
      !errorList?.length &&
      (passwordChanged() || defaultValue.isAdmin !== value.isAdmin)
    ) {
      try {
        await editUser()
      } catch (err) {
        errorList = errorHandler(err, errorList)
      }
    }

    setErrors(errorList)
    if (!errorList?.length) {
      props.onClose()
    }
  }

  if (!isSessionReady) return <Spinner />

  return (
    <FormDialog
      title='Edit User Access'
      loading={editUserStatus.loading}
      errors={nonFieldErrors(editUserStatus.error)}
      onClose={props.onClose}
      onSubmit={submitHandler}
      notices={
        props.role === 'admin' &&
        props.userID === currentUserID &&
        !value.isAdmin
          ? [
              {
                type: 'WARNING',
                message: 'Updating role to User',
                details:
                  'If you remove your admin privileges you will need to log in as a different admin to restore them.',
              },
            ]
          : []
      }
      form={
        <UserEditForm
          value={value}
          errors={errors}
          admin={isAdmin}
          onChange={(value) => {
            setValue(value)
          }}
        />
      }
    />
  )
}

export default UserEditDialog
