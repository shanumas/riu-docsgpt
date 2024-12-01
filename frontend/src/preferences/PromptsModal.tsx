import { ActiveState } from '../models/misc';
import Exit from '../assets/exit.svg';
import Input from '../components/Input';
import React from 'react';

function AddPrompt({
  setModalState,
  handleAddPrompt,
  newPromptName,
  setNewPromptName,
  newPromptContent,
  setNewPromptContent,
  disableSave,
}: {
  setModalState: (state: ActiveState) => void;
  handleAddPrompt?: () => void;
  newPromptName: string;
  setNewPromptName: (name: string) => void;
  newPromptContent: string;
  setNewPromptContent: (content: string) => void;
  disableSave: boolean;
}) {
  return (
    <div className="relative">
      <button
        className="absolute top-3 right-4 m-2 w-3"
        onClick={() => {
          setModalState('INACTIVE');
          setNewPromptName('');
          setNewPromptContent('');
        }}
      >
        <img className="filter dark:invert" src={Exit} />
      </button>
      <div className="p-8">
        <p className="mb-1 text-xl text-jet dark:text-bright-gray">
          Add Prompt
        </p>
        <p className="mb-7 text-xs text-[#747474] dark:text-[#7F7F82]">
          Add your custom prompt and save it to riuGPT
        </p>
        <div>
          <Input
            placeholder="Prompt Name"
            type="text"
            className="h-10 rounded-lg"
            value={newPromptName}
            onChange={(e) => setNewPromptName(e.target.value)}
          />
          <div className="relative bottom-12 left-3 mt-[-3.00px]">
            <span className="bg-white px-1 text-xs text-silver dark:bg-outer-space dark:text-silver">
              Prompt Name
            </span>
          </div>
          <div className="relative top-[7px] left-3">
            <span className="bg-white px-1 text-xs text-silver dark:bg-outer-space dark:text-silver">
              Prompt Text
            </span>
          </div>
          <textarea
            className="h-56 w-full rounded-lg border-2 border-silver px-3 py-2 outline-none dark:border-silver/40 dark:bg-transparent dark:text-white"
            value={newPromptContent}
            onChange={(e) => setNewPromptContent(e.target.value)}
          ></textarea>
        </div>
        <div className="mt-6 flex flex-row-reverse">
          <button
            onClick={handleAddPrompt}
            className="rounded-3xl bg-purple-30 px-5 py-2 text-sm text-white transition-all hover:opacity-90"
            disabled={disableSave}
            title={disableSave && newPromptName ? 'Name already exists' : ''}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditPrompt({
  setModalState,
  handleEditPrompt,
  editPromptName,
  setEditPromptName,
  editPromptContent,
  setEditPromptContent,
  currentPromptEdit,
  disableSave,
}: {
  setModalState: (state: ActiveState) => void;
  handleEditPrompt?: (id: string, type: string) => void;
  editPromptName: string;
  setEditPromptName: (name: string) => void;
  editPromptContent: string;
  setEditPromptContent: (content: string) => void;
  currentPromptEdit: { name: string; id: string; type: string };
  disableSave: boolean;
}) {
  return (
    <div className="relative">
      <button
        className="absolute top-3 right-4 m-2 w-3"
        onClick={() => {
          setModalState('INACTIVE');
        }}
      >
        <img className="filter dark:invert" src={Exit} />
      </button>
      <div className="p-8">
        <p className="mb-1 text-xl text-jet dark:text-bright-gray">
          Edit Prompt
        </p>
        <p className="mb-7 text-xs text-[#747474] dark:text-[#7F7F82]">
          Edit your custom prompt and save it to riuGPT
        </p>
        <div>
          <Input
            placeholder="Prompt Name"
            type="text"
            className="h-10 rounded-lg"
            value={editPromptName}
            onChange={(e) => setEditPromptName(e.target.value)}
          ></Input>
          <div className="relative bottom-12 left-3 mt-[-3.00px]">
            <span className="bg-white px-1 text-xs text-silver dark:bg-outer-space dark:text-silver">
              Prompt Name
            </span>
          </div>
          <div className="relative top-[7px] left-3">
            <span className="bg-white px-1 text-xs text-silver dark:bg-outer-space dark:text-silver">
              Prompt Text
            </span>
          </div>
          <textarea
            className="h-56 w-full rounded-lg border-2 border-silver px-3 py-2 outline-none dark:border-silver/40 dark:bg-transparent dark:text-white"
            value={editPromptContent}
            onChange={(e) => setEditPromptContent(e.target.value)}
          ></textarea>
        </div>
        <div className="mt-6 flex flex-row-reverse gap-4">
          <button
            className={`rounded-3xl bg-purple-30 px-5 py-2 text-sm text-white transition-all ${
              currentPromptEdit.type === 'public'
                ? 'cursor-not-allowed opacity-50'
                : 'hover:opacity-90'
            }`}
            onClick={() => {
              handleEditPrompt &&
                handleEditPrompt(currentPromptEdit.id, currentPromptEdit.type);
            }}
            disabled={currentPromptEdit.type === 'public' || disableSave}
            title={disableSave && editPromptName ? 'Name already exists' : ''}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromptsModal({
  existingPrompts,
  modalState,
  setModalState,
  type,
  newPromptName,
  setNewPromptName,
  newPromptContent,
  setNewPromptContent,
  editPromptName,
  setEditPromptName,
  editPromptContent,
  setEditPromptContent,
  currentPromptEdit,
  handleAddPrompt,
  handleEditPrompt,
}: {
  existingPrompts: { name: string; id: string; type: string }[];
  modalState: ActiveState;
  setModalState: (state: ActiveState) => void;
  type: 'ADD' | 'EDIT';
  newPromptName: string;
  setNewPromptName: (name: string) => void;
  newPromptContent: string;
  setNewPromptContent: (content: string) => void;
  editPromptName: string;
  setEditPromptName: (name: string) => void;
  editPromptContent: string;
  setEditPromptContent: (content: string) => void;
  currentPromptEdit: { name: string; id: string; type: string };
  handleAddPrompt?: () => void;
  handleEditPrompt?: (id: string, type: string) => void;
}) {
  const [disableSave, setDisableSave] = React.useState(true);
  const handlePrompNameChange = (edit: boolean, newName: string) => {
    const nameExists = existingPrompts.find(
      (prompt) => newName === prompt.name,
    );

    if (newName && !nameExists) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }

    if (edit) {
      setEditPromptName(newName);
    } else {
      setNewPromptName(newName);
    }
  };

  let view;

  if (type === 'ADD') {
    view = (
      <AddPrompt
        setModalState={setModalState}
        handleAddPrompt={handleAddPrompt}
        newPromptName={newPromptName}
        setNewPromptName={handlePrompNameChange.bind(null, false)}
        newPromptContent={newPromptContent}
        setNewPromptContent={setNewPromptContent}
        disableSave={disableSave}
      />
    );
  } else if (type === 'EDIT') {
    view = (
      <EditPrompt
        setModalState={setModalState}
        handleEditPrompt={handleEditPrompt}
        editPromptName={editPromptName}
        setEditPromptName={handlePrompNameChange.bind(null, true)}
        editPromptContent={editPromptContent}
        setEditPromptContent={setEditPromptContent}
        currentPromptEdit={currentPromptEdit}
        disableSave={disableSave}
      />
    );
  } else {
    view = <></>;
  }
  return (
    <article
      className={`${
        modalState === 'ACTIVE' ? 'visible' : 'hidden'
      } fixed top-0 left-0 z-30  h-screen w-screen  bg-gray-alpha`}
    >
      <article className="mx-auto mt-24 flex w-[90vw] max-w-lg  flex-col gap-4 rounded-2xl bg-white shadow-lg dark:bg-outer-space">
        {view}
      </article>
    </article>
  );
}
