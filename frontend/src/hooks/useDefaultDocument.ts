import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getDocs } from '../preferences/preferenceApi';
import { Doc } from '../models/misc';
import {
  selectSelectedDocs,
  setSelectedDocs,
  setSelectedGuideDocs,
  setSourceDocs,
} from '../preferences/preferenceSlice';

export default function useDefaultDocument() {
  const dispatch = useDispatch();
  const selectedDoc = useSelector(selectSelectedDocs);

  const fetchDocs = () => {
    getDocs().then((data) => {
      dispatch(setSourceDocs(data));
      if (!selectedDoc)
        Array.isArray(data) &&
          data?.forEach((doc: Doc) => {
            if (doc.model && doc.name === 'default')
              if (doc.doc_type === 'user') {
                dispatch(setSelectedDocs(doc));
              } else if (doc.doc_type === 'guide') {
                dispatch(setSelectedDocs(doc));
                dispatch(setSelectedGuideDocs(doc));
              }
          });
    });
  };

  React.useEffect(() => {
    fetchDocs();
  }, []);
}
